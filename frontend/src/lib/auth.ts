import { Amplify } from 'aws-amplify';
import { signUp, confirmSignUp, signIn, signOut, getCurrentUser, fetchAuthSession, resetPassword, confirmResetPassword, fetchUserAttributes, deleteUser } from 'aws-amplify/auth';

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
        userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '',
      }
    }
  });
}

export { signUp, confirmSignUp, signIn, signOut, getCurrentUser, fetchAuthSession, resetPassword, confirmResetPassword, fetchUserAttributes, deleteUser };

export const checkIsAdmin = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    const attrs = await fetchUserAttributes();
    return attrs.email === 'yukiyakiyu854@icloud.com';
  } catch (e) {
    return false;
  }
};
