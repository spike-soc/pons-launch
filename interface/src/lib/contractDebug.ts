type ContractReadRow = {
  status?: string;
  result?: unknown;
  error?: { message?: string } | null;
};

type ContractReadDebugArgs = {
  scope: string;
  contract: string;
  method: string;
  args?: readonly unknown[] | null;
  row: ContractReadRow | undefined;
  fields: Record<string, string | undefined>;
};

function serializeContractValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeContractValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeContractValue(item)])
    );
  }

  return value ?? null;
}

/** One console line per readContract: method / contract / args / status / raw / fields. */
export function logContractRead({
  scope,
  contract,
  method,
  args,
  row,
  fields
}: ContractReadDebugArgs) {
  const raw = serializeContractValue(row?.result);

  if (raw === null) {
    return;
  }

  console.log(`[${scope}] readContract.${method}`, {
    method,
    contract,
    args: serializeContractValue(args ?? []),
    status: row?.status ?? 'missing',
    raw,
    error: row?.error?.message ?? null,
    fields
  });
}
