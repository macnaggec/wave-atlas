import HomePage from 'views/HomePage/ui/HomePage';

// Force dynamic rendering to avoid build-time prerender errors
export const dynamic = 'force-dynamic';

// Revalidate every 24 hours - spots don't change often
export const revalidate = 86400; // 24 hours in seconds

export default async function Page() {
  return <HomePage />;
}
