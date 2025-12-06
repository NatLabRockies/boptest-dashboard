import express from 'express';

import {getAPIKeyByHashedIdentifier, regenerateApiKey} from '../controllers/account';
import {authorizer} from './authRoutes';
import {Account} from './../../common/interfaces';
import {updateDisplayName as persistDisplayName, updateGlobalShare as persistGlobalShare} from '../models/Account';
import {validateSessionCsrf} from '../utils/security';

type AuthedAccount = Account & {
  privileged?: boolean;
};

export const accountRouter = express.Router();
accountRouter.use(authorizer);

accountRouter.get('/info', (req: express.Request, res: express.Response) => {
  if (req.session && req.session.userId) {
    return res.json({
      displayName: req.session.displayName || '',
      hashedIdentifier: req.session.hashedIdentifier || '',
      privileged: false,
      userId: Number(req.session.userId),
      shareAllResults: req.session.shareAllResults || false,
    });
  }

  if (req.user) {
    const user = req.user as AuthedAccount;
    return res.json({
      displayName: user.displayName || '',
      hashedIdentifier: user.hashedIdentifier || '',
      privileged: user.privileged || false,
      userId: user.id ? Number(user.id) : 0,
      shareAllResults: user.shareAllResults || false,
    });
  }

  res.json({
    displayName: '',
    hashedIdentifier: '',
    privileged: false,
    userId: 0,
    shareAllResults: false,
  });
});

function requireAccount(req: express.Request, res: express.Response): AuthedAccount | null {
  if (req.user) {
    return req.user as AuthedAccount;
  }
  res.status(401).json({error: 'Unauthorized'});
  return null;
}

accountRouter.patch('/display-name', async (req: express.Request, res: express.Response) => {
  const account = requireAccount(req, res);
  if (!account) {
    return;
  }

  if (!validateSessionCsrf(req, res)) {
    return;
  }

  const newDisplayName = req.body.newDisplayName;
  if (!newDisplayName) {
    return res.status(400).json({error: 'Display name is required'});
  }

  try {
    const updatedAccount = await persistDisplayName(account.id, newDisplayName);
    if (!updatedAccount) {
      return res.status(404).json({error: 'Account not found'});
    }

    if (req.session) {
      req.session.displayName = updatedAccount.displayName;
    }
    req.user = {
      ...account,
      displayName: updatedAccount.displayName,
      privileged: (account as any).privileged,
    };

    res.json({success: true, displayName: updatedAccount.displayName});
  } catch (err) {
    console.error('Error updating display name:', err);
    res.status(500).json({error: 'Server error'});
  }
});

accountRouter.get('/key', async (req: express.Request, res: express.Response) => {
  const account = requireAccount(req, res);
  if (!account) {
    return;
  }

  if (!validateSessionCsrf(req, res)) {
    return;
  }

  try {
    const keyHolder = await getAPIKeyByHashedIdentifier(account.hashedIdentifier);
    res.json({apiKey: keyHolder.apiKey});
  } catch (err) {
    console.error('Error retrieving API key:', err);
    res.status(500).json({error: 'Failed to get API key'});
  }
});

accountRouter.post('/regenerate-key', async (req: express.Request, res: express.Response) => {
  const account = requireAccount(req, res);
  if (!account) {
    return;
  }

  if (!validateSessionCsrf(req, res)) {
    return;
  }

  try {
    const updatedAccount = await regenerateApiKey(account.hashedIdentifier);
    res.json({apiKey: updatedAccount.apiKey, success: true});
  } catch (err) {
    console.error('Error regenerating API key:', err);
    res.status(500).json({error: 'Failed to regenerate API key'});
  }
});

accountRouter.patch('/global-share', async (req: express.Request, res: express.Response) => {
  const account = requireAccount(req, res);
  if (!account) {
    return;
  }

  if (!validateSessionCsrf(req, res)) {
    return;
  }

  try {
    const shareAllResults = req.body.shareAllResults ?? null;
    const updatedAccount = await persistGlobalShare(account.id, shareAllResults);

    if (!updatedAccount) {
      return res.status(404).json({error: 'Account not found'});
    }

    if (req.session) {
      req.session.shareAllResults = shareAllResults;
    }

    req.user = {
      ...account,
      shareAllResults,
      privileged: (account as any).privileged,
    };

    res.json({success: true});
  } catch (err) {
    console.error('Error updating share settings:', err);
    res.status(500).json({error: 'Server error'});
  }
});
