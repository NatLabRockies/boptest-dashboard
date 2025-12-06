import React, { useEffect } from 'react';
import { Typography, Link as MuiLink, Divider, Checkbox, FormControlLabel } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import {createStyles, makeStyles, Theme} from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';
import {AlertProps} from '@material-ui/lab/Alert';
import {SvgIconProps} from '@material-ui/core/SvgIcon';
import { legalNoticeParagraphs } from './legalContent';

// Icons for OAuth buttons
import GitHubIcon from '@material-ui/icons/GitHub';
import LockIcon from '@material-ui/icons/Lock';
import SecurityIcon from '@material-ui/icons/Security';
// Adding Google icon
import SvgIcon from '@material-ui/core/SvgIcon';

const Alert = (props: AlertProps) => (
  <MuiAlert elevation={6} variant="filled" {...props} />
);

// Custom Google icon component
const GoogleIcon: React.FC<SvgIconProps> = props => (
  <SvgIcon {...props}>
    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
  </SvgIcon>
);

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
    },
    paper: {
      padding: '2em',
      width: '90%',
      maxWidth: '400px',
      borderRadius: '8px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    logo: {
      width: '120px',
      marginBottom: '1.5em',
    },
    title: {
      marginBottom: '0.5em',
      fontWeight: 600,
      textAlign: 'center',
      color: '#333',
    },
    subtitle: {
      marginBottom: '1.5em',
      textAlign: 'center',
      color: '#666',
    },
    divider: {
      width: '50px',
      margin: '10px 0 20px',
      backgroundColor: theme.palette.primary.main,
      height: '2px',
    },
    oauthSection: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      marginTop: '1em',
    },
    legalSection: {
      width: '100%',
      marginTop: '1.5em',
    },
    legalHeading: {
      fontWeight: 600,
      color: '#333',
      marginBottom: '0.5em',
    },
    legalScrollContainer: {
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '0.75em',
      maxHeight: '150px',
      overflowY: 'auto',
      backgroundColor: '#fafafa',
    },
    legalParagraph: {
      marginBottom: '0.75em',
      color: '#555',
    },
    legalCheckbox: {
      marginTop: '0.5em',
      alignSelf: 'flex-start',
    },
    legalHelper: {
      marginTop: '0.25em',
      color: '#b26a00',
    },
    oauthButton: {
      margin: '8px 0',
      padding: '12px',
      textTransform: 'none',
      fontWeight: 500,
      borderRadius: '4px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.15)',
        transform: 'translateY(-2px)',
      },
    },
    googleButton: {
      backgroundColor: '#ffffff',
      color: '#757575',
      border: '1px solid #eaeaea',
      '&:hover': {
        backgroundColor: '#f8f8f8',
      },
    },
    githubButton: {
      backgroundColor: '#24292e',
      color: 'white',
      '&:hover': {
        backgroundColor: '#3a3a3a',
      },
    },
    oauthIcon: {
      marginRight: '12px',
    },
    privacyInfo: {
      marginTop: '2em',
      fontSize: '0.8em',
      textAlign: 'center',
      color: '#888',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    securityIcon: {
      fontSize: '16px',
      marginRight: '6px',
      color: theme.palette.primary.main,
    },
    oauthDisabledText: {
      marginTop: '0.5em',
      color: '#c62828',
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: '1em',
      color: '#666',
    },
  })
);

export const Login: React.FC = () => {
  const classes = useStyles();
  const [isLoading, setIsLoading] = React.useState(false);
  const [snackMessageOpen, setSnackMessageOpen] = React.useState(false);
  const [snackMessage, setSnackMessage] = React.useState('');
  const [legalAcknowledged, setLegalAcknowledged] = React.useState(false);
  const [legalScrollComplete, setLegalScrollComplete] = React.useState(false);

  const oauthDisabled = !legalAcknowledged;

  const handleLegalScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 4) {
      setLegalScrollComplete(true);
    }
  };

  const handleSnackMessageClose = (
    _: React.SyntheticEvent,
    reason?: string
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackMessageOpen(false);
  };

  useEffect(() => {
    // Check if user came from a redirect
    const query = new URLSearchParams(window.location.search);
    
    // Handle login success
    if (query.get('login') === 'success') {
      setIsLoading(true);
      // Give time for the authentication to be processed
      setTimeout(() => {
        setIsLoading(false);
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        // Redirect to home page after successful login
        window.location.href = '/';
      }, 1000);
    }
    
    // Handle login errors
    if (query.get('error')) {
      const errorMessage = query.get('error');
      setSnackMessage(errorMessage === 'no_user_or_session' 
        ? 'Authentication failed. Please try again.'
        : 'Login error. Please try again.');
      setSnackMessageOpen(true);
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
  return (
    <div className={classes.root}>
      {isLoading ? (
        <div className={classes.loadingContainer}>
          <CircularProgress color="primary" size={50} />
          <Typography variant="body1" className={classes.loadingText}>
            Completing authentication...
          </Typography>
        </div>
      ) : (
        <Paper className={classes.paper} elevation={3}>
          <div className={classes.container}>
            {/* No logo on login page */}
            
            <Typography variant="h5" className={classes.title}>
              Welcome to BOPTEST
            </Typography>
            
            <Divider className={classes.divider} />
            
            <Typography variant="subtitle1" className={classes.subtitle}>
              Please sign in to continue
            </Typography>

            <div className={classes.legalSection}>
              <Typography variant="subtitle2" className={classes.legalHeading}>
                Review the legal notice before continuing
              </Typography>
              <div
                className={classes.legalScrollContainer}
                onScroll={handleLegalScroll}
              >
                {legalNoticeParagraphs.map((paragraph, idx) => (
                  <Typography
                    key={`legal-${idx}`}
                    variant="body2"
                    className={classes.legalParagraph}
                  >
                    {paragraph}
                  </Typography>
                ))}
                <Typography variant="body2" className={classes.legalParagraph}>
                  Detailed governance guidance lives in the{' '}
                  <MuiLink
                    href="https://github.com/ibpsa/project1-boptest/blob/main/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    BOPTEST documentation
                  </MuiLink>
                  .
                </Typography>
              </div>
              <FormControlLabel
                control={
                  <Checkbox
                    color="primary"
                    checked={legalAcknowledged}
                    disabled={!legalScrollComplete}
                    onChange={(_, checked) => setLegalAcknowledged(checked)}
                  />
                }
                label="I have read and agree to the access requirements above."
                className={classes.legalCheckbox}
              />
              {!legalScrollComplete && (
                <Typography variant="caption" className={classes.legalHelper}>
                  Scroll through the entire notice to enable the acknowledgement checkbox.
                </Typography>
              )}
            </div>
            
            <div className={classes.oauthSection}>
              <Button
                variant="contained"
                className={`${classes.oauthButton} ${classes.googleButton}`}
                href="/api/auth/google"
                size="large"
                startIcon={<GoogleIcon style={{ color: '#4285F4' }} />}
                onClick={() => setIsLoading(true)}
                disabled={oauthDisabled}
              >
                Continue with Google
              </Button>
              
              <Button
                variant="contained"
                className={`${classes.oauthButton} ${classes.githubButton}`}
                href="/api/auth/github"
                startIcon={<GitHubIcon />}
                size="large"
                onClick={() => setIsLoading(true)}
                disabled={oauthDisabled}
              >
                Continue with GitHub
              </Button>
              {oauthDisabled && (
                <Typography variant="caption" className={classes.oauthDisabledText}>
                  Legal acknowledgement required before OAuth sign up is enabled.
                </Typography>
              )}
            </div>
            
            <div className={classes.privacyInfo}>
              <SecurityIcon className={classes.securityIcon} />
              <Typography variant="body2">
                We respect your privacy. No personal information is stored.
              </Typography>
            </div>
          </div>
        </Paper>
      )}
      <Snackbar
        open={snackMessageOpen}
        autoHideDuration={6000}
        onClose={handleSnackMessageClose}
      >
        <Alert onClose={handleSnackMessageClose} severity="error">
          {snackMessage}
        </Alert>
      </Snackbar>
    </div>
  );
};
