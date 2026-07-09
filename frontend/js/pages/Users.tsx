import { Link, useLoaderData } from 'react-router';

import { PaginatedUserList } from '@/js/api';
import { AppLayout } from '@/js/components';
import { makeLink } from '@/js/utils';

const Users = () => {
  const data = useLoaderData<PaginatedUserList>();

  const prev = makeLink(data.previous);
  const next = makeLink(data.next);

  return (
    <AppLayout subtitle="Usuarios del sistema" title="Usuarios">

        <ul className="panoptes-card divide-y divide-outline-variant/30 overflow-hidden">
          {data?.results?.map((u) => (
            <li
              key={u.id}
              className="px-4 py-3 text-sm text-on-surface hover:bg-secondary-container/20"
            >
              {u.email}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-on-surface-variant">
            {data?.results?.length} on this page • {data.count} total
          </span>

          <div className="flex items-center gap-2">
            {!prev ? (
              <span
                aria-disabled="true"
                className="panoptes-btn-primary opacity-45 pointer-events-none"
                tabIndex={-1}
              >
                ← Previous
              </span>
            ) : (
              <Link
                className="panoptes-btn-primary"
                to={prev}
              >
                ← Previous
              </Link>
            )}

            {!next ? (
              <span
                aria-disabled="true"
                className="panoptes-btn-primary opacity-45 pointer-events-none"
                tabIndex={-1}
              >
                Next →
              </span>
            ) : (
              <Link
                className="panoptes-btn-primary"
                to={next}
              >
                Next →
              </Link>
            )}
          </div>
        </div>
    </AppLayout>
  );
};

export default Users;
