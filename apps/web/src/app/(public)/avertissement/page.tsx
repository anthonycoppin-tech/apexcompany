import { Article, DocumentLegal } from '@/components/document-legal';
import { SOCIETE } from '@/lib/legal/societe';

export const metadata = {
  title: 'Avertissement sur les risques',
  description:
    'Nature éducative des programmes, absence de conseil en investissement et risques des marchés financiers.',
};

/**
 * `/avertissement` — le « disclaimer » de l'ancien site, fusionné avec l'annexe
 * « Risk Disclosure » de ses CGV.
 *
 * Deux textes disaient la même chose sous deux noms, et le premier décrivait
 * une autre activité (« psychologie de la progression, stabilité intérieure »)
 * que celle que la CGV et le site vendent. Il n'en reste qu'un, en français, et
 * il fait partie des CGV : le client l'accepte avec elles, par la même case.
 *
 * L'ancienne adresse `/disclaimer` y redirige (`next.config.ts`), pour ne pas
 * casser les liens déjà publiés.
 */
export default function Page() {
  return (
    <DocumentLegal
      titre="Avertissement sur les risques"
      chapeau={
        <p>
          Ce texte fait partie des{' '}
          <a href="/cgv" className="text-accent underline">
            conditions générales de vente
          </a>
          . Vous l’acceptez avec elles avant tout achat.
        </p>
      }
    >
      <Article titre="1. Une activité exclusivement éducative">
        <p>
          {SOCIETE.nomCommercial} forme au trading : analyse des marchés, gestion du risque,
          psychologie et discipline de l’exécution. Rien de ce que nous publions ou enseignons ne
          constitue un conseil en investissement, personnalisé ou non, ni un conseil juridique,
          fiscal ou médical, ni une recommandation d’acheter ou de vendre un instrument financier.
          Nos contenus ne remplacent pas l’avis d’un professionnel qualifié.
        </p>
        <p>
          Nous ne gérons aucun compte, ne recevons aucun fonds destiné à être investi et
          n’intervenons jamais dans l’exécution de vos ordres. Nous ne sommes agréés par aucune
          autorité de supervision financière.
        </p>
      </Article>

      <Article titre="2. Les marchés comportent un risque de perte">
        <p>
          Intervenir sur les marchés financiers comporte des risques élevés, pouvant entraîner la{' '}
          <strong>perte partielle ou totale du capital engagé</strong>. Aucune méthode, aucun
          programme et aucun outil ne supprime ce risque.
        </p>
      </Article>

      <Article titre="3. Aucune garantie de résultat">
        <p>
          Nous ne garantissons aucune rentabilité, aucune progression, aucun revenu, ni la réussite
          d’une évaluation de société de financement (prop firm) ou l’obtention d’un financement.
          Les performances passées, les exemples, les études de cas et les témoignages ne préjugent
          pas des résultats futurs.
        </p>
      </Article>

      <Article titre="4. Votre responsabilité">
        <p>
          La décision d’intervenir sur un marché, le choix des montants engagés et l’usage que vous
          faites de nos contenus relèvent de votre seule liberté et de votre seule responsabilité.
          N’engagez que des sommes dont la perte n’affecterait pas votre situation.
        </p>
      </Article>

      <Article titre="5. Votre acceptation">
        <p>
          En cochant la case prévue avant de payer, vous reconnaissez avoir lu cet avertissement,
          comprendre la nature et l’ampleur des risques des marchés financiers, et les accepter.
        </p>
      </Article>
    </DocumentLegal>
  );
}
