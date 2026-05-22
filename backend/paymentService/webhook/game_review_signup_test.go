package main

import (
	"testing"

	"github.com/jackstenglein/chess-dojo-scheduler/backend/database"
)

func TestShouldSendGameReviewSignupNotification(t *testing.T) {
	tests := []struct {
		name     string
		previous database.SubscriptionTier
		next     database.SubscriptionTier
		want     bool
	}{
		{
			name:     "free to game review notifies",
			previous: database.SubscriptionTier_Free,
			next:     database.SubscriptionTier_GameReview,
			want:     true,
		},
		{
			name:     "lecture to game review notifies",
			previous: database.SubscriptionTier_Lecture,
			next:     database.SubscriptionTier_GameReview,
			want:     true,
		},
		{
			name:     "game review to game review does not duplicate",
			previous: database.SubscriptionTier_GameReview,
			next:     database.SubscriptionTier_GameReview,
			want:     false,
		},
		{
			name:     "game review to lecture does not notify",
			previous: database.SubscriptionTier_GameReview,
			next:     database.SubscriptionTier_Lecture,
			want:     false,
		},
		{
			name:     "free to basic does not notify",
			previous: database.SubscriptionTier_Free,
			next:     database.SubscriptionTier_Basic,
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldSendGameReviewSignupNotification(tt.previous, tt.next)
			if got != tt.want {
				t.Fatalf("shouldSendGameReviewSignupNotification(%q, %q) = %v, want %v", tt.previous, tt.next, got, tt.want)
			}
		})
	}
}
