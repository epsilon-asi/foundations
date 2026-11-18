import * as React from 'react';
import { Box, Step, StepConnector, StepLabel, Stepper, stepConnectorClasses, type StepIconProps, type StepperProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { CheckGlyph } from '../../internal/icons';

export interface StepperStep {
  id?: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
}

export interface GradientStepperProps extends Omit<StepperProps<'ol'>, 'children' | 'ref' | 'component'> {
  steps: readonly StepperStep[];
}

const GradientConnector = styled(StepConnector)(({ theme }) => ({
  [`& .${stepConnectorClasses.line}`]: { height: 4, border: 0, borderRadius: 4, backgroundColor: theme.palette.divider },
  [`&.${stepConnectorClasses.vertical} .${stepConnectorClasses.line}`]: { width: 4, height: 'auto', minHeight: 24 },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    backgroundImage: `linear-gradient(136deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    backgroundImage: `linear-gradient(136deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
  }
}));

function GradientStepIcon({ active, completed, icon, className }: StepIconProps) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      className={className}
      sx={(theme) => ({
        width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: theme.palette.action.disabledBackground,
        color: completed ? theme.palette.success.contrastText : active ? theme.palette.primary.contrastText : theme.palette.text.secondary,
        backgroundImage: completed
          ? `linear-gradient(136deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
          : active ? `linear-gradient(136deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})` : undefined,
        '& > svg': { fontSize: 18 }
      })}
    >
      {completed ? <CheckGlyph /> : icon}
    </Box>
  );
}

export const GradientStepper = React.forwardRef<HTMLOListElement, GradientStepperProps>(
  function GradientStepper({ steps, activeStep = 0, orientation = 'horizontal', alternativeLabel, nonLinear = false, sx, ...props }, ref) {
    return (
      <Stepper
        component="ol"
        ref={ref}
        activeStep={activeStep}
        orientation={orientation}
        nonLinear={nonLinear}
        alternativeLabel={alternativeLabel ?? orientation === 'horizontal'}
        connector={<GradientConnector />}
        tabIndex={orientation === 'horizontal' ? 0 : undefined}
        sx={[{ p: 0, m: 0, minWidth: 0, listStyle: 'none', overflowX: 'auto' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
        {...props}
      >
        {steps.map((step, index) => (
          <Step component="li" key={step.id ?? index} aria-current={index === activeStep ? 'step' : undefined}
            sx={{ minWidth: orientation === 'horizontal' ? 80 : 0, flexShrink: 0, overflowWrap: 'anywhere' }}>
            <StepLabel icon={step.icon ?? index + 1} slots={{ stepIcon: GradientStepIcon }}>
              <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>
                {!nonLinear && index < activeStep ? 'Completed: ' : index === activeStep ? 'Current: ' : 'Upcoming: '}
              </Box>
              {step.title}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    );
  }
);

GradientStepper.displayName = 'GradientStepper';
