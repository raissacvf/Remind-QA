export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
      <span>
        Página {page} de {pages} ({total} registros)
      </span>
      <div className="flex gap-2">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </button>
        <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Próxima
        </button>
      </div>
    </div>
  );
}
