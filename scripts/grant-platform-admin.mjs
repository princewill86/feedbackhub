import postgres from 'postgres';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL) {
  console.error('Usage: node --env-file=.env scripts/grant-platform-admin.mjs EMAIL');
  process.exitCode = 1;
} else {
  const db = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await db.begin(async (tx) => {
      const [account] = await tx`select id from users where email = ${email}`;
      if (!account) throw new Error('No registered account has that email.');
      const grants = await tx`
        insert into platform_administrators (user_id) values (${account.id})
        on conflict do nothing returning user_id
      `;
      if (grants.length) {
        await tx`insert into platform_audit (id, action, target)
          values (${crypto.randomUUID()}, 'Granted administrator access from console', ${account.id})`;
      }
    });
    console.log('Platform administrator access granted.');
  } finally {
    await db.end();
  }
}
