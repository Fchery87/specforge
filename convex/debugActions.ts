'use node';

import { internalAction } from './_generated/server';
import { internal } from './_generated/api';

// DEBUG: Simple test action to verify internal action calling works
export const debugTestCredentialsFlow = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log('[DEBUG] Starting credentials flow test...');
    console.log('[DEBUG] Timestamp:', Date.now());

    // Step 1: Check if we can access the internal systemCredentials module
    console.log(
      '[DEBUG] internal.systemCredentials exists:',
      !!internal.systemCredentials
    );
    console.log(
      '[DEBUG] getAllSystemCredentialsInternal exists:',
      !!internal.systemCredentials?.getAllSystemCredentialsInternal
    );

    // Step 2: Try to call the internal query
    let queryResult: any = null;
    let queryError: any = null;
    try {
      console.log(
        '[DEBUG] Calling runQuery for getAllSystemCredentialsInternal...'
      );
      queryResult = await ctx.runQuery(
        internal.systemCredentials.getAllSystemCredentialsInternal
      );
      console.log('[DEBUG] Query result count:', queryResult?.length);
      console.log(
        '[DEBUG] Query result:',
        JSON.stringify(
          queryResult?.map((c: any) => ({
            provider: c.provider,
            isEnabled: c.isEnabled,
            hasApiKey: !!c.apiKey,
            apiKeyType: c.apiKey ? typeof c.apiKey : 'none',
          }))
        )
      );
    } catch (error: any) {
      queryError = error;
      console.error('[DEBUG] Query failed with error:', error?.message);
      console.error('[DEBUG] Query error stack:', error?.stack);
    }

    // Step 3: Try to call getAllDecryptedSystemCredentials (the action itself)
    console.log(
      '[DEBUG] Now testing getAllDecryptedSystemCredentials action...'
    );
    let actionResult: any = null;
    let actionError: any = null;
    try {
      console.log(
        '[DEBUG] Calling runAction for getAllDecryptedSystemCredentials...'
      );
      actionResult = await ctx.runAction(
        internal.internalActions.getAllDecryptedSystemCredentials,
        {}
      );
      console.log('[DEBUG] Action result:', JSON.stringify(actionResult));
    } catch (error: any) {
      actionError = error;
      console.error('[DEBUG] Action failed with error:', error?.message);
      console.error('[DEBUG] Action error stack:', error?.stack);
    }

    return {
      querySuccess: !queryError,
      queryResult: queryResult ? queryResult.length : 0,
      queryError: queryError?.message,
      actionSuccess: !actionError,
      actionResult: actionResult ? Object.keys(actionResult) : [],
      actionError: actionError?.message,
    };
  },
});
