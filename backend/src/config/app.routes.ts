// Root
const root = 'realtime';

// Api Versions
const v1 = 'api/v1';

export const routesV1 = {
  version: v1,
  auth: {
    signin: `auth/signin`,
    signup: `auth/signup`,
    userInfo: `auth/user-info`,
    requestOtp: `auth/request-otp`,
    verifyOtp: `auth/verify-otp`,
    refreshToken: `auth/refresh-token`,
  },
  search: {
    searchContact: `${root}/search-user`,
  },
  user: {
    updateProfile: `auth/update-profile`,
    updateUser: `auth/update-user/:id`,
  },
  googleAuth: {
    googleAuth: `${root}/google`,
    googleRedirectUrl: `${root}/google/redirect`,
  },
  polling: {
    message: `${root}/polling`,
    createChat: `${root}/polling/create-chat`,
    getChatContentById: `${root}/polling/:id`,
    getChatIdUnreadMessage: `${root}/polling/unread/:id`,
  },
};
