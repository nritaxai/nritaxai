export const API_CONTRACTS = {
  auth: {
    profile: {
      method: "GET",
      path: "/api/auth/profile",
    },
    privacyStatus: {
      method: "GET",
      path: "/api/auth/privacy-status",
    },
    consent: {
      method: "PUT",
      path: "/api/auth/consent",
    },
  },
  chat: {
    completion: {
      method: "POST",
      path: "/api/chat",
    },
    history: {
      method: "GET",
      path: "/api/chat/history",
    },
  },
  payments: {
    createSubscription: {
      method: "POST",
      path: "/api/subscription/create-subscription",
    },
    verifySubscription: {
      method: "POST",
      path: "/api/subscription/verify-subscription",
    },
  },
};

export const DOMAIN_BOUNDARIES = {
  frontend: ["shared"],
  backend: ["shared", "ai-gateway"],
  aiGateway: ["shared"],
  workers: ["shared", "backend", "ai-gateway"],
  infrastructure: [],
  monitoring: [],
};
