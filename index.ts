import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
  AttachmentBuilder,
  TextChannel,
} from "discord.js";
import * as fs from "fs";
import { join } from "path";

const DB_FILE = join(process.cwd(), ".cache", "users.json");
let users: Record<
  string,
  { balance: number; purchases: Record<string, number> }
> = {};

if (fs.existsSync(DB_FILE)) {
  users = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

function getOrCreateUser(userId: string) {
  if (!users[userId]) {
    users[userId] = { balance: 0, purchases: {} };
    saveDB();
  }
  return users[userId];
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: {
    repliedUser: false,
  },
});

const loots = [
  {
    name: "Blood Coin",
    minVal: 5,
    maxVal: 10,
    minSpawn: 5 * 60,
    maxSpawn: 5 * 60,
    maxClaims: 5,
    duration: 30,
    image: "blood_coin.png",
  },
  {
    name: "Gore Coin",
    minVal: 15,
    maxVal: 30,
    minSpawn: 10 * 60,
    maxSpawn: 15 * 60,
    maxClaims: 5,
    duration: 60,
    image: "gore_coin.png",
  },
  {
    name: "Blood Money",
    minVal: 50,
    maxVal: 75,
    minSpawn: 20 * 60,
    maxSpawn: 35 * 60,
    maxClaims: 3,
    duration: 5 * 60,
    image: "blood_money.png",
  },
  {
    name: "Gore Money",
    minVal: 100,
    maxVal: 150,
    minSpawn: 60 * 60,
    maxSpawn: 120 * 60,
    maxClaims: 3,
    duration: 12 * 60,
    image: "gore_money.png",
  },
  {
    name: "Bleeding Treasure",
    minVal: 500,
    maxVal: 666,
    minSpawn: 60 * 60,
    maxSpawn: 180 * 60,
    maxClaims: 2,
    duration: 30 * 60,
    image: "bleeding_treasure.png",
  },
];

const shopItems: Record<
  string,
  { name: string; price: number; limit: number }
> = {
  namechange: { name: "Namechange Perm", price: 407, limit: 3 },
  image: { name: "Image Perm", price: 1023, limit: 3 },
  poll: { name: "Poll Perm", price: 3078, limit: 3 },
  xp100: { name: "100 XP", price: 143, limit: 100 },
  xp250: { name: "250 XP", price: 264, limit: 100 },
  xp350: { name: "350 XP", price: 539, limit: 100 },
  xp500: { name: "500 XP", price: 781, limit: 100 },
};

const activeClaims = new Map<
  string,
  {
    claimsLeft: number;
    claimedBy: Set<string>;
    messageId: string;
    channelId: string;
    lootName: string;
    value: number;
    duration: number;
    expiryTimestamp: number;
    image: string | null;
  }
>();

const getRandomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

async function commandReply(message: Message, payload: any) {
  const content = `<@${message.author.id}> ${payload.content || ""}`;
  if (message.channel.isSendable())
    await message.channel.send({ ...payload, content });
}

async function triggerSpawn(loot: (typeof loots)[0], channelId: string) {
  const value = getRandomInt(loot.minVal, loot.maxVal);
  const dropId = Date.now().toString() + getRandomInt(1, 1000).toString();
  const expiryTimestamp = Math.floor(Date.now() / 1000) + loot.duration;

  const files: AttachmentBuilder[] = [
    new AttachmentBuilder(`./media/${loot.image}`),
  ];
  const embed = new EmbedBuilder()
    .setTitle(`🩸 ${loot.name} Appeared!`)
    .setDescription(
      `Value: **${value}** | Claims available: **${loot.maxClaims}**\n` +
        `Disappears: <t:${expiryTimestamp}:R>`,
    )
    .setThumbnail(`attachment://${loot.image}`)
    .setColor("Red");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`claim_${dropId}`)
      .setLabel("Claim")
      .setStyle(ButtonStyle.Danger),
  );

  const channel = (await client.channels.fetch(channelId)) as TextChannel;
  if (channel) {
    const msg = await channel.send({
      embeds: [embed],
      components: [row],
      files: files,
    });

    activeClaims.set(dropId, {
      claimsLeft: loot.maxClaims,
      claimedBy: new Set(),
      messageId: msg.id,
      channelId: channel.id,
      lootName: loot.name,
      value: value,
      duration: loot.duration,
      expiryTimestamp: expiryTimestamp,
      image: loot.image,
    });

    setTimeout(() => {
      msg.delete().catch(() => {});
      activeClaims.delete(dropId);
    }, loot.duration * 1000);
  }
}

function scheduleSpawn(loot: (typeof loots)[0]) {
  const nextSpawnSeconds = getRandomInt(loot.minSpawn, loot.maxSpawn);
  setTimeout(async () => {
    await triggerSpawn(loot, Bun.env.CHANNEL_ID as string);
    scheduleSpawn(loot);
  }, nextSpawnSeconds * 1000);
}

client.once("ready", () => {
  console.log(`Log in: ${client.user?.tag}`);
  // loots.forEach((loot) => scheduleSpawn(loot));
});

const PREFIX = "rf ";

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.toLowerCase().startsWith(PREFIX))
    return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("🛠 FEARLESS Bot Commands")
      .setColor("DarkButNotBlack")
      .addFields(
        {
          name: "`rf rewards`",
          value: "Displays all possible loot drops.",
        },
        {
          name: "`rf balance`",
          value: "Check your current gorency balance.",
        },
        { name: "`rf inventory`", value: "Check your purchased items." },
        {
          name: "`rf receipt`",
          value: "Finalize and clear your purchases (1 use only!).",
        },
        {
          name: "`rf gift @user <amount>`",
          value: "Gift gorency to someone else.",
        },
        {
          name: "`rf spawnshop`",
          value: "(Admins only) Spawns the shop menu.",
        },
        {
          name: "`rf spawnreward <name>`",
          value: "(Admins only) Spawn loot instantly.",
        },
      );
    await commandReply(message, { embeds: [embed] });
  }

  if (
    command === "spawnreward" &&
    message.member?.permissions.has("Administrator")
  ) {
    const lootName = args.join(" ");
    const loot = loots.find(
      (l) => l.name.toLowerCase() === lootName.toLowerCase(),
    );
    if (!loot) {
      await commandReply(message, {
        content: `❌ Could not find loot named **${lootName}**.`,
      });
      return;
    }
    await triggerSpawn(loot, message.channelId);
  }

  if (command === "rewards") {
    const embed = new EmbedBuilder()
      .setTitle("🎁 Loot Table & Rewards")
      .setColor("DarkRed")
      .setDescription(
        loots
          .map(
            (l) =>
              `**${l.name}**\nValue: ${l.minVal}-${l.maxVal} | Spawns: every ${l.minSpawn / 60}m - ${l.maxSpawn / 60}m | Claims: ${l.maxClaims} | Stays for: ${l.duration >= 60 ? l.duration / 60 + "m" : l.duration + "s"}`,
          )
          .join("\n\n"),
      );
    await commandReply(message, { embeds: [embed] });
  }

  if (command === "balance" || command === "bal") {
    const user = getOrCreateUser(message.author.id);
    await commandReply(message, {
      content: `💰 Your current balance is: **${user.balance}** gorency.`,
    });
  }

  if (command === "inventory" || command === "inv") {
    const user = getOrCreateUser(message.author.id);
    const boughtItems = Object.entries(user.purchases)
      .map(
        ([key, count]) =>
          `**${shopItems[key]?.name || key}**: ${count} time(s)`,
      )
      .join("\n");
    const embed = new EmbedBuilder()
      .setTitle(`🎒 ${message.author.username}'s Inventory`)
      .setColor("Green")
      .setDescription(boughtItems || "Your inventory is empty.");
    await commandReply(message, { embeds: [embed] });
  }

  if (command === "gift") {
    const target = message.mentions.users.first();
    if (!target || target.id === message.author.id) {
      await commandReply(message, { content: "❌ Invalid target user!" });
      return;
    }
    const amountStr = args.find((arg) => !arg.startsWith("<@"));
    const amount = parseInt(amountStr || "");
    if (isNaN(amount) || amount <= 0) {
      await commandReply(message, {
        content: "❌ Please provide a valid amount!",
      });
      return;
    }
    const sender = getOrCreateUser(message.author.id);
    if (sender.balance < amount) {
      await commandReply(message, {
        content: `❌ Insufficient funds! Balance: **${sender.balance}**.`,
      });
      return;
    }
    sender.balance -= amount;
    const receiver = getOrCreateUser(target.id);
    receiver.balance += amount;
    saveDB();
    await commandReply(message, {
      content: `🎁 Gifted **${amount}** to ${target.toString()}!`,
    });
  }

  if (command === "receipt") {
    const user = getOrCreateUser(message.author.id);
    if (Object.keys(user.purchases).length === 0) {
      await commandReply(message, {
        content: "❌ You have no purchases to receipt!",
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("⚠️ Receipt Confirmation")
      .setDescription(
        "Generating this receipt is **1 use only**. It will delete all purchased items from your database after use.\n\n**Are you sure?**",
      )
      .setColor("Yellow");
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_receipt")
        .setLabel("Yes, Generate Receipt")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("cancel_receipt")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger),
    );
    await commandReply(message, { embeds: [embed], components: [row] });
  }

  if (
    command === "spawnshop" &&
    message.member?.permissions.has("Administrator")
  ) {
    const embed = new EmbedBuilder()
      .setTitle("🛒 Mysterious Shop")
      .setDescription(
        "Buy event perks here!\n\n" +
          Object.values(shopItems)
            .map((i) => `**${i.name}** - ${i.price} gorency`)
            .join("\n"),
      )
      .setColor("Purple");
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("shop_buy_namechange")
        .setLabel("Buy Namechange Perm")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("shop_buy_image")
        .setLabel("Buy Image Perm")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("shop_buy_poll")
        .setLabel("Buy Poll Perm")
        .setStyle(ButtonStyle.Primary),
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("shop_buy_xp100")
        .setLabel("100 XP")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("shop_buy_xp250")
        .setLabel("250 XP")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("shop_buy_xp350")
        .setLabel("350 XP")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("shop_buy_xp500")
        .setLabel("500 XP")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("shop_user_inventory")
        .setLabel("My Inventory")
        .setStyle(ButtonStyle.Secondary),
    );
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("shop_balance")
        .setLabel("Check Balance")
        .setStyle(ButtonStyle.Secondary),
    );
    await message.channel.send({
      embeds: [embed],
      components: [row1, row2, row3],
    });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "confirm_receipt") {
    const user = getOrCreateUser(interaction.user.id);
    if (Object.keys(user.purchases).length === 0) {
      return interaction.reply({
        content: "❌ No items found.",
        ephemeral: true,
      });
    }
    let totalSpent = 0;
    const itemsList = Object.entries(user.purchases)
      .map(([key, count]) => {
        const price = shopItems[key]?.price || 0;
        totalSpent += price * count;
        return `**${shopItems[key]?.name || key}**: ${count}x (${price * count} gorency)`;
      })
      .join("\n");
    const balBefore = user.balance + totalSpent;
    const finalEmbed = new EmbedBuilder()
      .setTitle(`🧾 Final Receipt for ${interaction.user.username}`)
      .setColor("Blue")
      .addFields(
        { name: "Purchased Items", value: itemsList || "None" },
        {
          name: "Calculation",
          value: `\`${balBefore} (Start) - ${totalSpent} (Spent) = ${user.balance}\``,
        },
        {
          name: "Balance after deduction",
          value: `**${user.balance}** gorency`,
        },
      );
    user.purchases = {};
    saveDB();
    return interaction.update({ embeds: [finalEmbed], components: [] });
  } else if (interaction.customId === "cancel_receipt") {
    await interaction.message.delete().catch(() => {});
  }

  if (interaction.customId.startsWith("shop_")) {
    const user = getOrCreateUser(interaction.user.id);
    if (interaction.customId === "shop_balance") {
      return interaction.reply({
        content: `💰 Your current balance is: **${user.balance}** gorency.`,
        ephemeral: true,
      });
    }
    if (interaction.customId === "shop_user_inventory") {
      const items = Object.entries(user.purchases)
        .map(([key, count]) => `**${shopItems[key]?.name || key}**: ${count}`)
        .join("\n");
      return interaction.reply({
        content: `🎒 **Your Purchased Items:**\n${items || "Nothing yet!"}`,
        ephemeral: true,
      });
    }
    const itemKey = interaction.customId.replace("shop_buy_", "");
    const item = shopItems[itemKey];
    if (item) {
      const currentPurchases = user.purchases[itemKey] || 0;
      if (currentPurchases >= item.limit) {
        return interaction.reply({
          content: `❌ You reached the limit for **${item.name}**!`,
          ephemeral: true,
        });
      }
      if (user.balance < item.price) {
        return interaction.reply({
          content: `❌ You need **${item.price}** gorency! Balance: **${user.balance}**.`,
          ephemeral: true,
        });
      }
      user.balance -= item.price;
      user.purchases[itemKey] = currentPurchases + 1;
      saveDB();
      return interaction.reply({
        content: `✅ Bought **${item.name}**! New balance: **${user.balance}**.`,
        ephemeral: true,
      });
    }
  }

  if (interaction.customId.startsWith("claim_")) {
    const dropId = interaction.customId.replace("claim_", "");
    const dropData = activeClaims.get(dropId);
    if (!dropData)
      return interaction.reply({
        content: "❌ This loot has expired or was fully claimed!",
        ephemeral: true,
      });
    if (dropData.claimedBy.has(interaction.user.id))
      return interaction.reply({
        content: "❌ You already claimed this drop!",
        ephemeral: true,
      });
    if (dropData.claimsLeft <= 0)
      return interaction.reply({
        content: "❌ Fully claimed!",
        ephemeral: true,
      });

    dropData.claimedBy.add(interaction.user.id);
    dropData.claimsLeft--;
    const user = getOrCreateUser(interaction.user.id);
    user.balance += dropData.value;
    saveDB();

    await interaction.reply({
      content: `🎉 Claimed **${dropData.lootName}** for **${dropData.value}**! Balance: ${user.balance}`,
      ephemeral: true,
    });

    if (dropData.claimsLeft === 0) {
      activeClaims.delete(dropId);
      interaction.message.delete().catch(() => {});
    } else {
      const updatedEmbed = new EmbedBuilder()
        .setTitle(`🩸 ${dropData.lootName} Appeared!`)
        .setDescription(
          `Value: **${dropData.value}** | Claims available: **${dropData.claimsLeft}**\nDisappears: <t:${dropData.expiryTimestamp}:R>`,
        )
        .setColor("Red");
      if (dropData.image)
        updatedEmbed.setThumbnail(`attachment://${dropData.image}`);
      await interaction.message
        .edit({ embeds: [updatedEmbed] })
        .catch(() => {});
    }
  }
});

client.login(Bun.env.TOKEN);
