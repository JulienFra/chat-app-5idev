import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Tests de bout en bout : on démarre la vraie application (mêmes réglages que main.ts)
// et on l'appelle en HTTP comme le ferait le frontend, sur une vraie base PostgreSQL.
// Les comptes créés ont un email en @e2e.test et sont supprimés à la fin.


const PASSWORD = 'motdepasse123';
const run = Date.now().toString(36).slice(-6); // suffixe unique : on peut relancer les tests

type Account = { id: string; token: string; pseudo: string };

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const auth = (account: Account) => ({ Authorization: `Bearer ${account.token}` });

  // Inscription + connexion d'un compte de test
  async function createAccount(name: string): Promise<Account> {
    const pseudo = `${name}_${run}`;
    const email = `${pseudo}@e2e.test`.toLowerCase();
    const registered = await http()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: pseudo })
      .expect(201);
    const login = await http()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { id: registered.body.id, token: login.body.access_token, pseudo };
  }

  // Une date dans N jours à 12:00 UTC (même jour à Bruxelles)
  function inDays(days: number): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(12, 0, 0, 0);
    return date;
  }

  const dayMonth = (date: Date) =>
    `${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

  let ceo: Account; // passera Premium
  let player: Account;
  let outsider: Account;
  let freeOwner: Account; // reste Free

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);

    ceo = await createAccount('ceo');
    player = await createAccount('player');
    outsider = await createAccount('outsider');
    freeOwner = await createAccount('free');
  });

  afterAll(async () => {
    // Supprime les comptes de test (et en cascade leurs équipes, salons, messages, events)
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
    await app.close();
  });

  // ---------------------------------------------------------------------------
  describe('Authentification', () => {
    it('refuse un pseudo avec un espace (400)', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: `space_${run}@e2e.test`, password: PASSWORD, displayName: 'Joueur 1' })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('pseudo');
    });

    it('refuse un pseudo déjà pris, même avec une autre casse (409)', async () => {
      await http()
        .post('/api/auth/register')
        .send({ email: `dup_${run}@e2e.test`, password: PASSWORD, displayName: ceo.pseudo.toUpperCase() })
        .expect(409);
    });

    it("ne renvoie jamais le hash du mot de passe à l'inscription", async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: `nohash_${run}@e2e.test`, password: PASSWORD, displayName: `nohash_${run}` })
        .expect(201);
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('refuse un mauvais mot de passe (401)', async () => {
      await http()
        .post('/api/auth/login')
        .send({ email: `${ceo.pseudo}@e2e.test`.toLowerCase(), password: 'mauvais-mdp' })
        .expect(401);
    });

    it('protège les routes : sans token → 401', async () => {
      await http().get('/api/conversations').expect(401);
      await http().get('/api/teams').expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Recherche de joueurs', () => {
    it('trouve un joueur par morceau de pseudo, sans email, sans soi-même', async () => {
      const res = await http()
        .get(`/api/users?search=${encodeURIComponent(`player_${run}`)}`)
        .set(auth(ceo))
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual({ id: player.id, displayName: player.pseudo });

      const self = await http()
        .get(`/api/users?search=${encodeURIComponent(ceo.pseudo)}`)
        .set(auth(ceo))
        .expect(200);
      expect(self.body).toHaveLength(0);
    });

    it('ne cherche pas avec moins de 2 caractères', async () => {
      const res = await http().get('/api/users?search=p').set(auth(ceo)).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Équipes, plans et rôles', () => {
    let teamId: string;
    let generalId: string;
    let adminId: string;

    const channelsOf = async (account: Account, team: string) => {
      const res = await http().get('/api/conversations').set(auth(account)).expect(200);
      return (res.body as { id: string; type: string; teamId: string | null }[]).filter(
        (c) => c.teamId === team,
      );
    };

    it('Free : une seule équipe, la deuxième est refusée (403)', async () => {
      await http().post('/api/teams').set(auth(ceo)).send({ name: 'Free Team' }).expect(201);
      await http().post('/api/teams').set(auth(ceo)).send({ name: 'Bloquee' }).expect(403);
    });

    it('Premium : nouvelle équipe avec #général et #admin', async () => {
      await http().patch('/api/users/me/plan').set(auth(ceo)).send({ plan: 'PREMIUM' }).expect(200);

      const res = await http().post('/api/teams').set(auth(ceo)).send({ name: 'Vitality Test' }).expect(201);
      teamId = res.body.id;
      expect(res.body.myRole).toBe('CEO');
      expect(res.body.limits.maxSlots).toBe(20);

      const channels = await channelsOf(ceo, teamId);
      generalId = channels.find((c) => c.type === 'GENERAL')!.id;
      adminId = channels.find((c) => c.type === 'ADMIN')!.id;
      expect(generalId).toBeDefined();
      expect(adminId).toBeDefined();
    });

    it("refuse deux équipes du même nom pour un même propriétaire (409)", async () => {
      await http().post('/api/teams').set(auth(ceo)).send({ name: 'vitality test' }).expect(409);
    });

    it("invitation : il faut l'accepter, et pas de doublon", async () => {
      const inv = await http()
        .post(`/api/teams/${teamId}/invitations`)
        .set(auth(ceo))
        .send({ inviteeId: player.id })
        .expect(201);

      // Une seule invitation en attente par joueur et par équipe
      await http()
        .post(`/api/teams/${teamId}/invitations`)
        .set(auth(ceo))
        .send({ inviteeId: player.id })
        .expect(409);

      // Avant d'accepter : aucun accès au salon
      expect(await channelsOf(player, teamId)).toHaveLength(0);

      // Le joueur la voit dans « Mes invitations », puis l'accepte
      const mine = await http().get('/api/invitations').set(auth(player)).expect(200);
      expect(mine.body.map((i: { id: string }) => i.id)).toContain(inv.body.id);
      await http().post(`/api/invitations/${inv.body.id}/accept`).set(auth(player)).expect(204);

      // Joueur : #général oui, #admin non
      const channels = await channelsOf(player, teamId);
      expect(channels.map((c) => c.type).sort()).toEqual(['GENERAL']);
    });

    it('un joueur ne peut pas inviter ni exclure (403)', async () => {
      await http()
        .post(`/api/teams/${teamId}/invitations`)
        .set(auth(player))
        .send({ inviteeId: outsider.id })
        .expect(403);
      await http().delete(`/api/teams/${teamId}/members/${ceo.id}`).set(auth(player)).expect(403);
    });

    it('passer coach donne accès à #admin, redevenir joueur le retire', async () => {
      await http()
        .patch(`/api/teams/${teamId}/members/${player.id}`)
        .set(auth(ceo))
        .send({ role: 'COACH' })
        .expect(204);
      expect((await channelsOf(player, teamId)).map((c) => c.type).sort()).toEqual(['ADMIN', 'GENERAL']);

      await http()
        .patch(`/api/teams/${teamId}/members/${player.id}`)
        .set(auth(ceo))
        .send({ role: 'PLAYER' })
        .expect(204);
      expect((await channelsOf(player, teamId)).map((c) => c.type)).toEqual(['GENERAL']);
    });

    it('messages : un membre écrit, un intrus est refusé (403), un message vide aussi (400)', async () => {
      await http()
        .post(`/api/conversations/${generalId}/messages`)
        .set(auth(player))
        .send({ content: 'GG les gars' })
        .expect(201);

      await http().get(`/api/conversations/${generalId}/messages`).set(auth(outsider)).expect(403);
      await http()
        .post(`/api/conversations/${generalId}/messages`)
        .set(auth(outsider))
        .send({ content: 'Je ne devrais pas pouvoir écrire ici' })
        .expect(403);
      await http()
        .post(`/api/conversations/${generalId}/messages`)
        .set(auth(player))
        .send({ content: '   ' })
        .expect(400);

      // Un joueur ne lit pas #admin
      await http().get(`/api/conversations/${adminId}/messages`).set(auth(player)).expect(403);
    });

    // -------------------------------------------------------------------------
    describe('Événements', () => {
      it('refuse des données invalides (400)', async () => {
        await http()
          .post(`/api/teams/${teamId}/events`)
          .set(auth(ceo))
          .send({ type: 'TOURNOI', opponent: 'Vitality', startsAt: inDays(2).toISOString() })
          .expect(400);
        await http()
          .post(`/api/teams/${teamId}/events`)
          .set(auth(ceo))
          .send({ type: 'SCRIM', opponent: '', startsAt: inDays(2).toISOString() })
          .expect(400);
        await http()
          .post(`/api/teams/${teamId}/events`)
          .set(auth(ceo))
          .send({ type: 'SCRIM', opponent: 'Vitality', startsAt: 'demain soir' })
          .expect(400);
      });

      it('refuse une date passée (400)', async () => {
        await http()
          .post(`/api/teams/${teamId}/events`)
          .set(auth(ceo))
          .send({ type: 'SCRIM', opponent: 'Vitality', startsAt: inDays(-1).toISOString() })
          .expect(400);
      });

      it('Premium : crée un salon dédié, avec un suffixe -2 en cas de doublon', async () => {
        const date = inDays(2);
        const body = { type: 'SCRIM', opponent: 'Équipe Rouge', startsAt: date.toISOString() };

        const first = await http().post(`/api/teams/${teamId}/events`).set(auth(ceo)).send(body).expect(201);
        const second = await http().post(`/api/teams/${teamId}/events`).set(auth(ceo)).send(body).expect(201);
        expect(first.body.conversationId).toBeTruthy();

        const channels = await http().get('/api/conversations').set(auth(player)).expect(200);
        const names = (channels.body as { id: string; name: string }[]);
        const nameOf = (id: string) => names.find((c) => c.id === id)?.name;
        expect(nameOf(first.body.conversationId)).toBe(`scrim-equipe-rouge-${dayMonth(date)}`);
        expect(nameOf(second.body.conversationId)).toBe(`scrim-equipe-rouge-${dayMonth(date)}-2`);
      });

      it("un joueur ne peut pas créer d'événement (403)", async () => {
        await http()
          .post(`/api/teams/${teamId}/events`)
          .set(auth(player))
          .send({ type: 'MATCH', opponent: 'KCorp', startsAt: inDays(3).toISOString() })
          .expect(403);
      });

      it("supprimer un événement supprime aussi son salon", async () => {
        const created = await http()
          .post(`/api/teams/${teamId}/events`)
          .set(auth(ceo))
          .send({ type: 'MATCH', opponent: 'G2', startsAt: inDays(4).toISOString() })
          .expect(201);

        await http()
          .delete(`/api/teams/${teamId}/events/${created.body.id}`)
          .set(auth(ceo))
          .expect(204);

        const res = await http().get('/api/conversations').set(auth(ceo)).expect(200);
        expect(res.body.map((c: { id: string }) => c.id)).not.toContain(created.body.conversationId);
      });

      it('Free : événement dans le calendrier, sans salon', async () => {
        const team = await http().post('/api/teams').set(auth(freeOwner)).send({ name: 'Petite Team' }).expect(201);
        const event = await http()
          .post(`/api/teams/${team.body.id}/events`)
          .set(auth(freeOwner))
          .send({ type: 'SCRIM', opponent: 'Karmine', startsAt: inDays(2).toISOString() })
          .expect(201);
        expect(event.body.conversationId).toBeNull();

        // L'événement apparaît bien dans l'équipe
        const teams = await http().get('/api/teams').set(auth(freeOwner)).expect(200);
        const petite = teams.body.find((t: { id: string }) => t.id === team.body.id);
        expect(petite.events.map((e: { id: string }) => e.id)).toContain(event.body.id);
      });
    });
  });
});