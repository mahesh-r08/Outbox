import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ReachInbox database seeding...');

  // By default, demo seeding is disabled. Enable by setting SEED_DEMO=true in the environment.
  if (process.env.SEED_DEMO !== 'true') {
    console.log('🔕 Demo seeding skipped (set SEED_DEMO=true to enable demo data).');
    return;
  }

  // 1. Create or update Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo.user@reachinbox.ai' },
    update: {},
    create: {
      email: 'demo.user@reachinbox.ai',
      name: 'Alex Rivera',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  });

  console.log(`👤 Created/Verified Demo User: ${demoUser.name} (${demoUser.email})`);

  // 2. Provision Ethereal sender
  let etherealAccount;
  try {
    etherealAccount = await nodemailer.createTestAccount();
    console.log(`📫 Provisioned free Ethereal SMTP account: ${etherealAccount.user}`);
  } catch (err: any) {
    console.warn('Could not auto-generate Ethereal credentials, using standard mock credentials');
    etherealAccount = {
      user: 'reachinbox.demo@ethereal.email',
      pass: 'demoPassword123!',
      smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
    };
  }

  // Clear existing senders for clean seed
  await prisma.sender.deleteMany({ where: { userId: demoUser.id } });

  const sender = await prisma.sender.create({
    data: {
      userId: demoUser.id,
      name: 'ReachInbox Growth Mailbox',
      email: etherealAccount.user,
      smtpHost: etherealAccount.smtp.host,
      smtpPort: etherealAccount.smtp.port,
      smtpUser: etherealAccount.user,
      smtpPassword: etherealAccount.pass,
      hourlyLimit: 200,
    },
  });

  console.log(`✉️ Created Sender: ${sender.name} (${sender.email})`);

  // 3. Create a Sample Campaign
  const campaign = await prisma.emailCampaign.create({
    data: {
      userId: demoUser.id,
      senderId: sender.id,
      subject: 'Quick question regarding your outbound strategy',
      body: 'Hi {{name}},\n\nI noticed your team has been scaling outreach. Are you currently utilizing AI-driven deliverability?\n\nBest,\nAlex',
      startTime: new Date(),
      delayMs: 2000,
      hourlyLimit: 200,
      totalRecipients: 3,
      status: 'completed',
    },
  });

  // 4. Create sample Sent Emails
  await prisma.scheduledEmail.createMany({
    data: [
      {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'sarah.connor@example.com',
        subject: 'Quick question regarding your outbound strategy',
        body: 'Hi Sarah,\n\nI noticed your team has been scaling outreach. Are you currently utilizing AI-driven deliverability?\n\nBest,\nAlex',
        scheduledAt: new Date(Date.now() - 60000),
        sentAt: new Date(Date.now() - 58000),
        status: 'sent',
        messageId: '<reachinbox-sample-1@ethereal.email>',
        previewUrl: 'https://ethereal.email/message/sample1',
      },
      {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'john.wick@continental.com',
        subject: 'Quick question regarding your outbound strategy',
        body: 'Hi John,\n\nI noticed your team has been scaling outreach. Are you currently utilizing AI-driven deliverability?\n\nBest,\nAlex',
        scheduledAt: new Date(Date.now() - 40000),
        sentAt: new Date(Date.now() - 38000),
        status: 'sent',
        messageId: '<reachinbox-sample-2@ethereal.email>',
        previewUrl: 'https://ethereal.email/message/sample2',
      },
      {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'bruce.wayne@waynecorp.com',
        subject: 'Quick question regarding your outbound strategy',
        body: 'Hi Bruce,\n\nI noticed your team has been scaling outreach. Are you currently utilizing AI-driven deliverability?\n\nBest,\nAlex',
        scheduledAt: new Date(Date.now() + 120000),
        status: 'scheduled',
      },
    ],
  });

  console.log('✅ Seed completed successfully with Demo User, Mailbox, and Sample Emails.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
