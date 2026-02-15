export const metadata = {
  title: "Vercel GitHub Time Cron",
  description: "Cron jobs that append timestamps to a file and commit to GitHub."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", margin: 0 }}>
        <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
