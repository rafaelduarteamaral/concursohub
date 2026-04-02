import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!email || !password) return null;
        if (email === adminEmail && password === adminPassword) {
          return { id: '1', email, name: 'Administrador' };
        }

        // Support additional allowed emails from env
        const allowedEmails = (process.env.ALLOWED_EMAILS || '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

        if (allowedEmails.includes(email) && password === adminPassword) {
          return { id: email, email, name: email };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
