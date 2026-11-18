import * as React from 'react';
import { Avatar, Box, Card, CardActions, CardContent, CardMedia, Chip, Stack, Typography, type CardProps } from '@mui/material';

export interface ContactCardProps extends Omit<CardProps, 'title'> {
  name: string;
  photo?: string;
  jobTitle?: React.ReactNode;
  skills?: readonly string[];
  graphic?: string;
  actions?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export const ContactCard = React.forwardRef<HTMLDivElement, ContactCardProps>(
  function ContactCard({ name, photo, jobTitle, skills, graphic, actions, align = 'center', sx, ...props }, ref) {
    const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

    return (
      <Card ref={ref} sx={[{ height: '100%', minWidth: 0, overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} {...props}>
        <CardMedia aria-hidden="true" image={graphic} sx={{ height: 72, bgcolor: 'primary.dark' }} />
        <Box sx={{ display: 'flex', justifyContent: align, mt: '-32px', px: 3 }}>
          <Avatar
            alt={name}
            src={photo}
            sx={(theme) => ({ width: 64, height: 64, bgcolor: 'primary.main', color: 'primary.contrastText', border: `3px solid ${theme.palette.background.paper}` })}
          >
            {initials || '?'}
          </Avatar>
        </Box>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ textAlign: align }}>
              <Typography component="h2" variant="h6">{name}</Typography>
              {jobTitle != null ? <Typography color="text.secondary" variant="body2">{jobTitle}</Typography> : null}
            </Box>
            {skills && skills.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: align }}>
                {skills.map((skill, index) => <Chip key={`${skill}-${index}`} label={skill} title={skill} variant="outlined" size="small" sx={{ maxWidth: '100%' }} />)}
              </Box>
            ) : null}
          </Stack>
        </CardContent>
        {actions ? <CardActions disableSpacing sx={{ justifyContent: align, flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>{actions}</CardActions> : null}
      </Card>
    );
  }
);

ContactCard.displayName = 'ContactCard';
