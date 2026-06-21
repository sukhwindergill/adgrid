const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
};

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockResolvedValue({ error: null }),
  insert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

const mockAuth = {
  getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signUp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
};

const mockClient = {
  auth: mockAuth,
  from: jest.fn(() => mockQuery),
  channel: jest.fn(() => mockChannel),
  removeChannel: jest.fn(),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/photo.jpg' } })),
    })),
  },
};

module.exports = {
  createClient: jest.fn(() => mockClient),
};
