import { Link } from 'react-router';

import { APP_PATHS } from '../../app/paths';

export function NotFoundPage() {
  return (
    <section className="glass-panel mx-auto mt-16 max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted mt-2 text-sm">That address does not match a page in this app.</p>
      <Link
        to={APP_PATHS.home}
        className="text-accent mt-4 inline-block text-sm underline-offset-4 hover:underline"
      >
        Go home
      </Link>
    </section>
  );
}
