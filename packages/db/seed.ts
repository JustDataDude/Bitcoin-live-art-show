import { prisma } from "./src";

async function main() {
  // Create users
  const host = await prisma.user.upsert({
    where: { handle: "host_1" },
    update: {},
    create: { handle: "host_1", username: "GameShowHost", role: "HOST" },
  });

  const artist1 = await prisma.user.upsert({
    where: { handle: "artist_1" },
    update: {},
    create: { handle: "artist_1", username: "CryptoArtist1", role: "ARTIST" },
  });

  const viewer1 = await prisma.user.upsert({
    where: { handle: "viewer_1" },
    update: {},
    create: { handle: "viewer_1", username: "CryptoCollector", role: "viewer" },
  });

  const viewer2 = await prisma.user.upsert({
    where: { handle: "viewer_2" },
    update: {},
    create: { handle: "viewer_2", username: "NFTEnthusiast", role: "viewer" },
  });

  // Create show
  const show = await prisma.show.upsert({
    where: { id: "seed-show-1" },
    update: {},
    create: {
      id: "seed-show-1",
      title: "1 of 1's Game Show - Season 1",
      status: "LIVE",
      artistId: artist1.id,
    },
  });

  // Create lot
  const lot = await prisma.lot.upsert({
    where: { id: "seed-lot-1" },
    update: {},
    create: {
      id: "seed-lot-1",
      showId: show.id,
      title: "Exclusive Digital Art - Live Auction",
      description: "One-of-one digital artwork created live during the show. Authentic Bitcoin inscription.",
      currency: "USD",
      status: "LIVE",
      reserveUsd: 100,
      tipsTotalUsd: 0,
    },
  });

  // Add some sample bids
  await prisma.bid.create({
    data: {
      lotId: lot.id,
      userId: viewer1.id,
      amountUsd: 150,
    },
  });

  await prisma.bid.create({
    data: {
      lotId: lot.id,
      userId: viewer2.id,
      amountUsd: 200,
    },
  });

  // Add some sample tips
  await prisma.tip.create({
    data: {
      lotId: lot.id,
      userId: viewer1.id,
      amountUsd: 5,
      message: "Love the energy! 🔥",
      chain: "BTC",
    },
  });

  console.log("✅ Seed data created:", { host, artist1, viewer1, viewer2, show, lot });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
