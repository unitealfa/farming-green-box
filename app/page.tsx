export default function Page() {
  return (
    <>
      <h1>Vercel GitHub Time Cron</h1>
      <p>
        Cette app est faite pour tourner sur Vercel avec des Cron Jobs. À chaque exécution, une route sécurisée
        ajoute une ligne (date + heure Algérie) dans <code>status.txt</code> dans ton repo GitHub, puis fait un commit
        via l’API GitHub.
      </p>
      <p>
        Pour tester manuellement, appelle l’endpoint cron avec un header Authorization:
        <br />
        <code>Authorization: Bearer {"<CRON_SECRET>"}</code>
      </p>
    </>
  );
}
