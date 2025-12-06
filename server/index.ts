import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import bodyParser from 'body-parser';
import session from 'express-session';
import passport from 'passport';
import {URL} from 'url';
import {Account} from '../common/interfaces';
import {resolveClientBuildDir} from './utils/paths';

import {accountRouter} from './routes/accountRoutes';
import {appRouter} from './routes/appRoutes';
import {setupRouter} from './routes/setupRoutes';
import {authRouter} from './routes/authRoutes';
import {resultRouter} from './routes/resultRoutes';
import {connectToDb} from './db';
import {getAccountById} from './controllers/account';

const app: express.Application = express();
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Configure CORS to allow credentials
const rawOrigins = process.env.CORS_ORIGINS || '';
const parsedOrigins = rawOrigins
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0);

const defaultOrigins = new Set<string>();
const callbackBase = process.env.CALLBACK_URL_BASE;


const parseOrigin = (value: string): string | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (err) {
    try {
      const parsedFallback = new URL(`https://${value}`);
      return `${parsedFallback.protocol}//${parsedFallback.host}`;
    } catch (_) {
      return null;
    }
  }
};

if (callbackBase) {
  const parsed = parseOrigin(callbackBase);
  if (parsed) {
    defaultOrigins.add(parsed);
  }
}

['http://localhost:3000', 'http://127.0.0.1:3000'].forEach(origin => defaultOrigins.add(origin));
parsedOrigins.forEach(origin => {
  const parsed = parseOrigin(origin);
  if (parsed) {
    defaultOrigins.add(parsed);
  }
});

const allowedOrigins = Array.from(defaultOrigins).filter(origin => origin.length > 0);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Blocked CORS request from origin ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow cookies to be sent with requests
}));

// Parse request body
app.use(bodyParser.json());

const SESSION_NAME = process.env.SESSION_NAME!;
const SESSION_SECRET = process.env.SESSION_SECRET!;
const IN_PROD: boolean = process.env.NODE_ENV! === 'production';

// Debug session configuration
console.log('Session config:', {
  name: SESSION_NAME,
  secret: SESSION_SECRET ? 'set' : 'not set',
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 8*60*60*1000, // 8 Hours
    sameSite: true,
    secure: IN_PROD,
  }
});

app.use(
  session({
    name: SESSION_NAME,
    secret: SESSION_SECRET,
    resave: false,             // Only save session when modified
    saveUninitialized: false,  // Don't create session until something stored
    cookie: {
      maxAge: 8*60*60*1000,    // 8 Hours
      sameSite: 'lax',         // Balance between security and functionality
      secure: IN_PROD,         // HTTPS in production, HTTP in development
      httpOnly: true,          // Prevent JavaScript access to session cookie
      domain: process.env.COOKIE_DOMAIN || undefined // Configure domain from env var
    },
  })
);

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization setup
passport.serializeUser((user: any, done: any) => {
  done(null, user.id);
});

passport.deserializeUser((id: any, done: any) => {
  getAccountById(parseInt(id))
    .then((account) => {
      done(null, account);
    })
    .catch((err) => {
      done(err, null);
    });
});

// serve static files from the React app
console.log('ENV:', process.env.NODE_ENV);
const clientBuildDir = resolveClientBuildDir();

if (!IN_PROD) {
  console.log(`Serving static files from ${clientBuildDir}`);
  app.use(express.static(clientBuildDir));
} else {
  console.log('Serving static files from nginx');
}

// define routes
app.use('/api/auth', authRouter);
app.use('/api/setup', setupRouter);
app.use('/api/accounts', accountRouter);
app.use('/api/results', resultRouter);
app.use('/', appRouter);

const {PORT = 8080} = process.env;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('server started at http://localhost:' + PORT);
    connectToDb();
  });
}

export default app;
