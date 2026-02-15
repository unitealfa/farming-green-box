export default function Page() {
  return (
    <>
      <h1>Accès Restreint</h1>
      <p>
        Cette interface est réservée à un usage interne et à des opérations automatisées. 
        Toute consultation non autorisée ou tentative d’analyse de ce dépôt est enregistrée et surveillée.
      </p>
      <p>
        Si vous n’êtes pas explicitement autorisé à être ici, veuillez quitter immédiatement.
      </p>
      <p>
        Endpoint technique :
        <br />
        <code>Authorization: Bearer {"<CRON_SECRET>"}</code>
      </p>
    </>
  );
}
