import { PositionComment } from '@/database/game';
import Avatar from '@/profile/Avatar';
import { Stack, Tooltip, Typography } from '@mui/material';

interface InlinePositionCommentsProps {
    comments: PositionComment[];
}

export default function InlinePositionComments({ comments }: InlinePositionCommentsProps) {
    if (comments.length === 0) {
        return null;
    }

    return (
        <Stack spacing={0.75} px={1} py={0.75}>
            {comments.map((comment) => (
                <Stack
                    key={comment.id}
                    data-testid='inline-position-comment'
                    direction='row'
                    alignItems='flex-start'
                    spacing={0.75}
                >
                    <Tooltip title={`Comment by ${comment.owner.displayName}`}>
                        <span>
                            <Avatar
                                username={comment.owner.username}
                                displayName={comment.owner.displayName}
                                size={24}
                            />
                        </span>
                    </Tooltip>
                    <Typography
                        variant='body2'
                        color='text.primary'
                        whiteSpace='pre-line'
                        sx={{ minWidth: 0, wordBreak: 'break-word' }}
                    >
                        {comment.content.trim()}
                    </Typography>
                </Stack>
            ))}
        </Stack>
    );
}
