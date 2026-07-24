package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackstenglein/chess-dojo-scheduler/backend/api/errors"
	"github.com/jackstenglein/chess-dojo-scheduler/backend/api/log"
	"github.com/jackstenglein/chess-dojo-scheduler/backend/database"
	"github.com/jackstenglein/chess-dojo-scheduler/backend/user/ratings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	lambdasvc "github.com/aws/aws-sdk-go/service/lambda"
)

type Event events.CloudWatchEvent

const (
	chunkSize        = 50
	flushSize        = 25
	maxContinuations = 10
	maxNotFoundCount = 3
	// checkpointBuffer is the remaining-time threshold below which the
	// handler stops and re-invokes itself. Chosen together with the 700s
	// UpdateRatingsTimeoutAlarm: normal runs end around 600s elapsed plus
	// one user's processing time, staying under the alarm.
	checkpointBuffer = 300 * time.Second
)

type ratingsRepository interface {
	ListUserRatingsPage(cohort database.DojoCohort, startKey string, limit int64) ([]*database.User, string, error)
	UpdateUserRatings(users []*database.User) error
}

type lambdaInvoker interface {
	Invoke(input *lambdasvc.InvokeInput) (*lambdasvc.InvokeOutput, error)
}

var repository ratingsRepository = database.DynamoDB
var invoker lambdaInvoker = lambdasvc.New(session.Must(session.NewSession()))
var fetchBulkLichess = ratings.FetchBulkLichessRatings
var fetchChesscom ratings.RatingFetchFunc = ratings.FetchChesscomRatingWithRetry

var remainingTime = func(ctx context.Context) time.Duration {
	deadline, ok := ctx.Deadline()
	if !ok {
		return time.Duration(1<<62 - 1)
	}
	return time.Until(deadline)
}

// now is refreshed at the start of each invocation: package init runs once per
// container, and warm containers cross day boundaries.
var now = time.Now()

type isBannedFunc func(username string) bool

type RatingUpdateRequest struct {
	Cohorts           []database.DojoCohort `json:"cohorts"`
	StartKey          string                `json:"startKey,omitempty"`
	ContinuationCount int                   `json:"continuationCount,omitempty"`
}

// tracksNotFound reports whether not-found suppression applies to the system.
// Restricted to Chesscom and Lichess: other systems overload 404 with
// different semantics (e.g. USCF returns 404 for "no regular rating").
func tracksNotFound(system database.RatingSystem) bool {
	return system == database.Chesscom || system == database.Lichess
}

func updateRating(rating *database.Rating, system database.RatingSystem, fetcher ratings.RatingFetchFunc) bool {
	rating.Username = strings.TrimSpace(rating.Username)
	if rating.Username == "" {
		return false
	}

	if tracksNotFound(system) && rating.NotFoundCount >= maxNotFoundCount {
		return false
	}

	data, err := fetcher(rating.Username)
	if err != nil {
		if tracksNotFound(system) && errors.Is(err, ratings.ErrNotFound) {
			rating.NotFoundCount++
			log.Infof("%s username %q not found (count %d)", system, rating.Username, rating.NotFoundCount)
			return true
		}
		log.Errorf("Failed to get %s rating for %q: %v", system, rating.Username, err)
		return false
	}

	shouldUpdate := rating.NotFoundCount != 0
	rating.NotFoundCount = 0

	if data.CurrentRating != rating.CurrentRating || data.Deviation != rating.Deviation || data.NumGames != rating.NumGames || data.IsProvisional != rating.IsProvisional {
		rating.CurrentRating = data.CurrentRating
		rating.Deviation = data.Deviation
		rating.NumGames = data.NumGames
		rating.IsProvisional = data.IsProvisional
		shouldUpdate = true
	}

	if rating.StartRating == 0 {
		rating.StartRating = data.CurrentRating
		shouldUpdate = true
	}

	return shouldUpdate
}

func updateUser(user *database.User, fetchFuncs map[database.RatingSystem]ratings.RatingFetchFunc, isBannedLichess isBannedFunc) bool {
	shouldUpdate := false

	for system, rating := range user.Ratings {
		if system != database.Custom && system != database.Custom2 && system != database.Custom3 {
			shouldUpdate = updateRating(rating, system, fetchFuncs[system]) || shouldUpdate
		}

		if system == database.Lichess && isBannedLichess(rating.Username) {
			if user.LichessBan == "" {
				user.LichessBan = rating.Username
				shouldUpdate = true
			}
		}

		if now.Weekday() == time.Monday {
			history := user.RatingHistories[system]
			if rating.CurrentRating > 0 && (len(history) == 0 || history[len(history)-1].Rating != rating.CurrentRating) {
				if user.RatingHistories == nil {
					user.RatingHistories = make(map[database.RatingSystem][]database.RatingHistory)
				}
				user.RatingHistories[system] = append(history, database.RatingHistory{
					Date:   now.Format(time.RFC3339),
					Rating: rating.CurrentRating,
				})
				shouldUpdate = true
			}
		}
	}

	return shouldUpdate
}

// fetchLichessRatings bulk-fetches lichess ratings for all users in the chunk,
// excluding suppressed usernames. ok=false means the bulk call itself failed
// and no user may be treated as missing.
func fetchLichessRatings(users []*database.User) (map[string]ratings.LichessResponse, bool) {
	var usernames []string
	for _, user := range users {
		if lichess := user.Ratings[database.Lichess]; lichess != nil && lichess.NotFoundCount < maxNotFoundCount {
			if username := strings.TrimSpace(lichess.Username); username != "" {
				usernames = append(usernames, username)
			}
		}
	}

	result, err := fetchBulkLichess(usernames)
	if err != nil {
		log.Error(err)
		return nil, false
	}
	return result, true
}

func ratingFetchFuncs(lichessRatings map[string]ratings.LichessResponse, lichessOK bool) map[database.RatingSystem]ratings.RatingFetchFunc {
	fetchLichess := func(username string) (*database.Rating, error) {
		if !lichessOK {
			return nil, errors.New(500, "Temporary server error", "Lichess bulk fetch failed; skipping user")
		}
		rating, ok := lichessRatings[strings.ToLower(username)]
		if !ok {
			return nil, errors.Wrap(404, "Invalid request: lichess user not found in bulk response", "", ratings.ErrNotFound)
		}
		return &database.Rating{
			CurrentRating: rating.Performances.Classical.Rating,
			Deviation:     rating.Performances.Classical.Deviation,
			NumGames:      rating.Performances.Classical.NumGames,
			IsProvisional: rating.Performances.Classical.IsProvisional,
		}, nil
	}

	funcs := make(map[database.RatingSystem]ratings.RatingFetchFunc, len(ratings.RatingFetchFuncs))
	for system, fetch := range ratings.RatingFetchFuncs {
		funcs[system] = fetch
	}
	funcs[database.Chesscom] = fetchChesscom
	funcs[database.Lichess] = fetchLichess
	return funcs
}

func flush(queued []*database.User) error {
	if len(queued) == 0 {
		return nil
	}
	if err := repository.UpdateUserRatings(queued); err != nil {
		log.Errorf("Failed to update %d users: %v", len(queued), err)
		return err
	}
	log.Infof("Updated %d users", len(queued))
	return nil
}

// cursorForUser builds a startKey resuming the CohortIdx query after the given
// user, byte-compatible with DynamoDB's LastEvaluatedKey encoding in
// repository.query.
func cursorForUser(cohort database.DojoCohort, user *database.User) string {
	key := map[string]*dynamodb.AttributeValue{
		"dojoCohort": {S: aws.String(string(cohort))},
		"username":   {S: aws.String(user.Username)},
	}
	b, err := json.Marshal(key)
	if err != nil {
		log.Errorf("Failed to marshal cursor for user %q: %v", user.Username, err)
		return ""
	}
	return string(b)
}

// updateUsers processes users in order. It returns the cursor of the last
// persisted user ("" if none), whether all users were processed, and any
// write error. On a write error the checkpoint must not advance.
func updateUsers(cohort database.DojoCohort, users []*database.User, outOfTime func() bool) (string, bool, error) {
	if len(users) == 0 {
		return "", true, nil
	}

	lichessRatings, lichessOK := fetchLichessRatings(users)
	fetchFuncs := ratingFetchFuncs(lichessRatings, lichessOK)
	isBannedLichess := func(username string) bool {
		result, ok := lichessRatings[strings.ToLower(username)]
		return ok && result.TosViolation
	}

	var queued []*database.User
	for i, user := range users {
		if outOfTime() {
			if err := flush(queued); err != nil {
				return "", false, err
			}
			if i == 0 {
				return "", false, nil
			}
			return cursorForUser(cohort, users[i-1]), false, nil
		}

		if updateUser(user, fetchFuncs, isBannedLichess) {
			queued = append(queued, user)
			if len(queued) == flushSize {
				if err := flush(queued); err != nil {
					return "", false, err
				}
				queued = nil
			}
		}
	}

	if err := flush(queued); err != nil {
		return "", false, err
	}
	return "", true, nil
}

// checkpoint asynchronously re-invokes this function to continue processing
// from startKey. It fails loudly at the continuation cap.
func checkpoint(event Event, cohorts []database.DojoCohort, startKey string, continuationCount int) error {
	if continuationCount+1 > maxContinuations {
		err := errors.New(500, "Temporary server error", fmt.Sprintf("updateRatings hit the continuation cap (%d) for cohorts %v without completing", maxContinuations, cohorts))
		log.Error(err)
		return err
	}

	req := RatingUpdateRequest{
		Cohorts:           cohorts,
		StartKey:          startKey,
		ContinuationCount: continuationCount + 1,
	}
	detail, err := json.Marshal(req)
	if err != nil {
		return errors.Wrap(500, "Temporary server error", "Failed to marshal continuation request", err)
	}

	baseID := strings.Split(event.ID, "-cont")[0]
	continuation := Event{
		ID:         fmt.Sprintf("%s-cont%d", baseID, continuationCount+1),
		DetailType: event.DetailType,
		Source:     event.Source,
		Region:     event.Region,
		Detail:     detail,
	}
	payload, err := json.Marshal(continuation)
	if err != nil {
		return errors.Wrap(500, "Temporary server error", "Failed to marshal continuation event", err)
	}

	output, err := invoker.Invoke(&lambdasvc.InvokeInput{
		FunctionName:   aws.String(os.Getenv("AWS_LAMBDA_FUNCTION_NAME")),
		InvocationType: aws.String(lambdasvc.InvocationTypeEvent),
		Payload:        payload,
	})
	if err != nil {
		return errors.Wrap(500, "Temporary server error", "Failed to invoke continuation", err)
	}
	if aws.Int64Value(output.StatusCode) != 202 {
		return errors.New(500, "Temporary server error", fmt.Sprintf("Continuation invoke returned status %d", aws.Int64Value(output.StatusCode)))
	}

	log.Infof("Checkpointed: cohorts=%v startKey=%s continuation=%d", cohorts, startKey, continuationCount+1)
	return nil
}

func Handler(ctx context.Context, event Event) (Event, error) {
	log.Infof("Event: %#v", event)
	log.SetRequestId(event.ID)
	now = time.Now()

	var req RatingUpdateRequest
	if err := json.Unmarshal(event.Detail, &req); err != nil {
		log.Errorf("Failed to unmarshal request: %v", err)
		return event, err
	}
	log.Infof("Request: %+v", req)

	outOfTime := func() bool { return remainingTime(ctx) < checkpointBuffer }

	for i, cohort := range req.Cohorts {
		startKey := ""
		if i == 0 {
			startKey = req.StartKey
		}

		for {
			users, nextKey, err := repository.ListUserRatingsPage(cohort, startKey, chunkSize)
			if err != nil {
				log.Errorf("Failed to query users: %v", err)
				return event, err
			}

			cursor, completed, err := updateUsers(cohort, users, outOfTime)
			if err != nil {
				return event, err
			}
			if !completed {
				if cursor == "" {
					cursor = startKey
				}
				return event, checkpoint(event, req.Cohorts[i:], cursor, req.ContinuationCount)
			}

			log.Infof("Processed chunk: cohort=%s users=%d continuation=%d", cohort, len(users), req.ContinuationCount)

			if nextKey == "" {
				break
			}
			startKey = nextKey

			if outOfTime() {
				return event, checkpoint(event, req.Cohorts[i:], nextKey, req.ContinuationCount)
			}
		}
		log.Infof("Cohort complete: cohort=%s continuation=%d", cohort, req.ContinuationCount)
	}

	return event, nil
}

func main() {
	lambda.Start(Handler)
}
