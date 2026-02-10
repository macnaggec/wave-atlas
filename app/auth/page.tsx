import { Suspense } from 'react';
import { AuthPage } from 'views/AuthPage';
import { auth } from '../../auth';
import { redirect } from 'next/navigation';

export default async function AuthPageRoute() {
  // Redirect authenticated users to home page
  const session = await auth();

  if (session?.user) {
    redirect('/');
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthPage />
    </Suspense>
  );
}
