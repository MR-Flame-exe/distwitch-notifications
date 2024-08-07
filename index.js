const { Client, Intents, MessageEmbed, Collection } = require("discord.js");
const cooldowns = new Collection();
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const {
  token,
  CLIENT_ID,
  twitch_id,
  twitch_token,
  twitch_secret,
  COMMAND_COOLDOWN,
} = require("./util/config");
const guilds = require("./streamers.json");
const fs = require("fs");
const phin = require("phin");
const guildsLength = Object.keys(guilds).length;

function getStreamerLength() {
  let streamersLength = 0;

  for (let position = 0; position <= guildsLength - 1; position++) {
    const position_object = Object.keys(guilds)[position];

    const guild = guilds[position_object];

    streamersLength = streamersLength + guild.streamers.length;
  }

  return Number(streamersLength);
}

const commands = [
  {
    name: "add_your_twitch",
    description:
      "Add your twitch and when you will stream, I will send a notification on this server!",
    options: [
      {
        name: "twitch_username",
        description: "Your twitch username!",
        required: true,
        type: 3,
      },
    ],
  },

  {
    name: "set_notification_channel",
    description: "Set the notification channel for this server!",
    default_member_permissions: 1 << 3,
    options: [
      {
        name: "notification_channel",
        description:
          "Select the channel that you would like that I send a notification in!",
        required: true,
        type: 7,
        channel_types: [0, 5],
      },
    ],
  },

  {
    name: "change_the_twitch_of_a_member",
    description: "Change the twitch of a member for an other channel!",
    default_member_permissions: 1 << 3,
    options: [
      {
        name: "user",
        description: "The user wich I have to change the informations!",
        required: true,
        type: 6,
      },
      {
        name: "new_twitch_username",
        description: "The new twitch username!",
        required: true,
        type: 3,
      },
    ],
  },

  {
    name: "delete_the_twitch_of_a_member",
    description: "Delete the twitch of a member for an other channel!",
    default_member_permissions: 1 << 3,
    options: [
      {
        name: "user",
        description: "The user wich I have to change the informations!",
        required: true,
        type: 6,
      },
    ],
  },

  {
    name: "change_your_twitch",
    description: "Change your twitch!",
    options: [
      {
        name: "new_twitch_username",
        description: "Your new twitch username!",
        required: true,
        type: 3,
      },
    ],
  },

  {
    name: "your_twitch",
    description:
      "Display the current twitch channel linked to your discord id on this server!",
  },

  {
    name: "delete_your_twitch",
    description:
      "Delete the current twitch channel linked to your discord id on this server!",
  },
  {
    name: "set_admin_only",
    description:
      "Enable or disable the admin_only on this server in order to keep members to add their twitch!",
    default_member_permissions: 1 << 3,
  },
];

const rest = new REST({ version: "9" }).setToken(token);

(async () => {
  try {
    console.log(
      "Started refreshing application (/) commands.\n------------------------------------------------"
    );

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

    console.log(
      "Successfully reloaded application (/) commands.\n------------------------------------------------"
    );
  } catch (error) {
    console.error(error);
  }
})();

client.on("ready", () => {
  const streamerLength = getStreamerLength();

  client.user.setPresence({
    status: "online",
    activities: [
      {
        type: "WATCHING",
        name: `${streamerLength.toLocaleString("en-US")} streamers! 🎬`,
      },
    ],
  });

  setInterval(async () => {
    if (
      client.user.presence.activities[0] !=
      `${getStreamerLength().toLocaleString("en-US")} streamers! 🎬`
    ) {
      client.user.setPresence({
        status: "online",
        activities: [
          {
            type: "WATCHING",
            name: `${getStreamerLength().toLocaleString(
              "en-US"
            )} streamers! 🎬`,
          },
        ],
      });
    }
  }, 5 * 60 * 1000);

  console.log(
    `Logged in as ${
      client.user.tag
    }!\n------------------------------------------------\n${
      Object.keys(guilds).length
    } guilds are registered in the database!\n------------------------------------------------\n${streamerLength.toLocaleString(
      "en-US"
    )} streamers are registered in the database!\n------------------------------------------------`
  );

  for (let position = 0; position <= guildsLength - 1; position++) {
    const position_object = Object.keys(guilds)[position];

    const guild = guilds[position_object];

    console.log(`Fetching the ${Object.keys(guilds)[position]} guild!`);

    guild.fetched = false;

    fs.writeFile(
      "streamers.json",
      JSON.stringify(guilds),
      "utf-8",
      function (error) {
        if (error) {
          console.log(error);
        }
      }
    );
  }

  let currentGuildPostion = 0;

  let tries = 0;

  setInterval(async () => {
    if (Object.keys(guilds).length > 0) {
      var isStreaming = null;

      let currentGuild = Object.keys(guilds)[currentGuildPostion];

      const serverLength = Object.keys(guilds).length;

      const guild = guilds[currentGuild];

      if (guild.notification_channel !== null) {
        if (guild.fetched === false && guild.streamers.length > 0) {
          guild.streamers.forEach(async (streamer) => {
            if (streamer.fetched === false) {
              try {
                var result_twitch = await phin({
                  url: `https://api.twitch.tv/helix/streams?user_login=${streamer.twitch_username}`,
                  method: "GET",
                  parse: "json",
                  headers: {
                    Authorization: `Bearer ${twitch_token}`,
                    "Client-Id": twitch_id,
                  },
                });

                var result_twitch_user = await phin({
                  url: `https://api.twitch.tv/helix/users?id=${result_twitch.body.data[0].user_id}`,
                  method: "GET",
                  parse: "json",
                  headers: {
                    Authorization: `Bearer ${twitch_token}`,
                    "Client-Id": twitch_id,
                  },
                });
              } catch (error) {
                isStreaming = false;
              }

              try {
                if (
                  (result_twitch.statusCode === 401 &&
                    result_twitch.statusMessage === "Unauthorized") ||
                  (result_twitch_user.statusCode === 401 &&
                    result_twitch_user.statusMessage === "Unauthorized")
                ) {
                  const regenerate_token_access = (
                    await phin({
                      method: "POST",
                      url: `https://id.twitch.tv/oauth2/token?client_id=${twitch_id}&client_secret=${twitch_secret}&grant_type=client_credentials`,
                      parse: "json",
                    })
                  ).body;

                  const jsonData = JSON.parse(
                    fs.readFileSync("config.json", "utf8")
                  );

                  jsonData["twitch_token"] =
                    regenerate_token_access.access_token;

                  fs.writeFileSync("config.json", JSON.stringify(jsonData));

                  try {
                    var result_twitch = await phin({
                      url: `https://api.twitch.tv/helix/streams?user_login=${streamer.twitch_username}`,
                      method: "GET",
                      parse: "json",
                      headers: {
                        Authorization: `Bearer ${twitch_token}`,
                        "Client-Id": twitch_id,
                      },
                    });

                    var result_twitch_user = await phin({
                      url: `https://api.twitch.tv/helix/users?id=${result_twitch.body.data[0].user_id}`,
                      method: "GET",
                      parse: "json",
                      headers: {
                        Authorization: `Bearer ${twitch_token}`,
                        "Client-Id": twitch_id,
                      },
                    });
                  } catch (error) {
                    isStreaming = false;
                  }
                }
              } catch (error) {
                console.error(error);
              }

              try {
                if (isStreaming !== false) {
                  function replaceAll(
                    recherche,
                    remplacement,
                    chaineAModifier
                  ) {
                    return chaineAModifier.split(recherche).join(remplacement);
                  }

                  const thumbnail_url = replaceAll(
                    "{height}",
                    "1080",
                    replaceAll(
                      "{width}",
                      "1920",
                      result_twitch.body.data[0].thumbnail_url
                    )
                  );

                  const StreamingEmbed = new MessageEmbed()
                    .setAuthor({
                      name: `${result_twitch_user.body.data[0].display_name} is streaming!`,
                      url: `https://www.twitch.tv/${result_twitch.body.data[0].user_login}`,
                      iconURL:
                        result_twitch_user.body.data[0].profile_image_url,
                    })
                    .setColor("#9146FF")
                    .addFields(
                      {
                        name: "Game:",
                        value: result_twitch.body.data[0].game_name,
                        inline: true,
                      },
                      {
                        name: "Viewers:",
                        value:
                          result_twitch.body.data[0].viewer_count.toLocaleString(),
                        inline: true,
                      }
                    )
                    .setThumbnail(
                      "https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png"
                    )
                    .setDescription(result_twitch.body.data[0].title)
                    .setImage(thumbnail_url)
                    .setFooter({ text: streamer.adder_tag })
                    .setTimestamp();

                  client.guilds.cache
                    .get(currentGuild)
                    .channels.cache.get(guild.notification_channel)
                    .send({ embeds: [StreamingEmbed] });

                  new_data = {
                    fetched: true,
                    adder: streamer.adder,
                    adder_tag: streamer.adder_tag,
                    twitch_username: streamer.twitch_username,
                    twitch_url: `https://www.twitch.tv/${streamer.twitch_username}`,
                  };

                  function removeItemOnce(arr, value) {
                    var index = arr.indexOf(value);
                    if (index > -1) {
                      arr.splice(index, 1);
                    }
                    return arr;
                  }

                  await removeItemOnce(guild.streamers, streamer);

                  async function verify_null(array) {
                    let null_tries = 0;

                    array.forEach(async (data) => {
                      if (data === null || !data) {
                        null_tries = null_tries++;
                      }

                      if (null_tries === array.length) {
                        const new_array = array.filter((n) => n);

                        return new_array;
                      } else {
                        return array.filter((n) => n);
                      }
                    });
                  }

                  await verify_null(guild.streamers);

                  guild.streamers.push(new_data);

                  fs.writeFile(
                    "streamers.json",
                    JSON.stringify(guilds),
                    "utf-8",
                    function (error) {
                      if (error) {
                        console.log(error);
                      }
                    }
                  );

                  if (tries === guild.streamers.length - 1) {
                    tries = 0;
                  } else {
                    tries = tries + 1;
                  }

                  setTimeout(async () => {
                    function removeItemOnce(arr, value) {
                      var index = arr.indexOf(value);
                      if (index > -1) {
                        arr.splice(index, 1);
                      }
                      return arr;
                    }

                    await removeItemOnce(guild.streamers, streamer);

                    async function verify_null(array) {
                      let null_tries = 0;

                      array.forEach(async (data) => {
                        if (data === null || !data) {
                          null_tries = null_tries++;
                        }

                        if (null_tries === array.length) {
                          const new_array = array.filter((n) => n);

                          return new_array;
                        } else {
                          return array.filter((n) => n);
                        }
                      });
                    }

                    await verify_null(guild.streamers);

                    new_data = {
                      fetched: false,
                      adder: streamer.adder,
                      adder_tag: streamer.adder_tag,
                      twitch_username: streamer.twitch_username,
                      twitch_url: `https://www.twitch.tv/${streamer.twitch_username}`,
                    };

                    guild.streamers.push(new_data);

                    fs.writeFile(
                      "streamers.json",
                      JSON.stringify(guilds),
                      "utf-8",
                      function (error) {
                        if (error) {
                          console.log(error);
                        }
                      }
                    );
                  }, 175 * 60 * 1000);
                } else {
                  new_data = {
                    fetched: true,
                    adder: streamer.adder,
                    adder_tag: streamer.adder_tag,
                    twitch_username: streamer.twitch_username,
                    twitch_url: `https://www.twitch.tv/${streamer.twitch_username}`,
                  };

                  function removeItemOnce(arr, value) {
                    var index = arr.indexOf(value);
                    if (index > -1) {
                      arr.splice(index, 1);
                    }
                    return arr;
                  }

                  await removeItemOnce(guild.streamers, streamer);

                  async function verify_null(array) {
                    let null_tries = 0;

                    array.forEach(async (data) => {
                      if (data === null || !data) {
                        null_tries = null_tries++;
                      }

                      if (null_tries === array.length) {
                        const new_array = array.filter((n) => n);

                        return new_array;
                      } else {
                        return array.filter((n) => n);
                      }
                    });
                  }

                  await verify_null(guild.streamers);

                  guild.streamers.push(new_data);

                  fs.writeFile(
                    "streamers.json",
                    JSON.stringify(guilds),
                    "utf-8",
                    function (error) {
                      if (error) {
                        console.log(error);
                      }
                    }
                  );

                  if (tries === guild.streamers.length - 1) {
                    tries = 0;
                  } else {
                    tries = tries + 1;
                  }

                  setTimeout(async () => {
                    function removeItemOnce(arr, value) {
                      var index = arr.indexOf(value);
                      if (index > -1) {
                        arr.splice(index, 1);
                      }
                      return arr;
                    }

                    await removeItemOnce(guild.streamers, streamer);

                    async function verify_null(array) {
                      let null_tries = 0;

                      array.forEach(async (data) => {
                        if (data === null || !data) {
                          null_tries = null_tries++;
                        }

                        if (null_tries === array.length) {
                          const new_array = array.filter((n) => n);

                          return new_array;
                        } else {
                          return array.filter((n) => n);
                        }
                      });
                    }

                    await verify_null(guild.streamers);

                    new_data = {
                      fetched: false,
                      adder: streamer.adder,
                      adder_tag: streamer.adder_tag,
                      twitch_username: streamer.twitch_username,
                      twitch_url: `https://www.twitch.tv/${streamer.twitch_username}`,
                    };

                    guild.streamers.push(new_data);

                    fs.writeFile(
                      "streamers.json",
                      JSON.stringify(guilds),
                      "utf-8",
                      function (error) {
                        if (error) {
                          console.log(error);
                        }
                      }
                    );
                  }, 5 * 60 * 1000);
                }
              } catch (error) {}
            } else if (streamer.fetched === true) {
              return;
            }
          });

          guild.fetched = true;

          fs.writeFile(
            "streamers.json",
            JSON.stringify(guilds),
            "utf-8",
            function (error) {
              if (error) {
                console.log(error);
              }
            }
          );

          setTimeout(async () => {
            guild.fetched = false;

            fs.writeFile(
              "streamers.json",
              JSON.stringify(guilds),
              "utf-8",
              function (error) {
                if (error) {
                  console.log(error);
                }
              }
            );
          }, 5 * 60 * 1000);
        }
      }

      if (currentGuildPostion === serverLength - 1) {
        currentGuildPostion = 0;
      } else {
        currentGuildPostion = currentGuildPostion + 1;
      }
    }
  }, 30 * 1000);
});

client.on("guildCreate", async (guild) => {
  guilds[guild.id] = {
    fetched: false,
    notification_channel: null,
    streamers: [],
  };

  fs.writeFile(
    "streamers.json",
    JSON.stringify(guilds),
    "utf-8",
    function (error) {
      if (error) {
        console.log(error);
      }
    }
  );
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.user.bot === true) return;
  if (!interaction.guild) return;

  const slash_command = interaction.commandName;

  if (!slash_command) return;

  if (!cooldowns.has(slash_command)) {
    cooldowns.set(slash_command, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(slash_command);
  const cooldownAmount = (COMMAND_COOLDOWN || 5) * 1000;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return interaction.reply({
        content: `Sorry but you have to wait ${timeLeft.toFixed(
          1
        )} second(s) before reusing ${slash_command}`,
        ephemeral: true,
      });
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  if (!guilds[interaction.guild.id]) {
    guilds[interaction.guild.id] = {
      fetched: false,
      notification_channel: null,
      streamers: [],
      admin_only: false,
    };

    fs.writeFile(
      "streamers.json",
      JSON.stringify(guilds),
      "utf-8",
      function (error) {
        if (error) {
          console.log(error);
        }
      }
    );
  }

  if (interaction.commandName === "add_your_twitch") {
    try {
      const guild = guilds[interaction.guild.id];

      if (guild.admin_only === true) {
        if (!interaction.member.permissions.has(["ADMINISTRATOR"]))
          return interaction.reply({
            content:
              'You don\'t have permission to do this command, the "admin_only" mode is enabled! ❌',
            ephemeral: true,
          });
      }

      let already_exist = false;

      if (guild.streamers.length > 0) {
        guild.streamers.map(async (streamer) => {
          if (streamer.adder === interaction.user.id) {
            already_exist = true;
          }
        });

        if (already_exist === false) {
          const twitch_username = interaction.options
            .getString("twitch_username")
            .toLocaleLowerCase();

          const new_data = {
            fetched: false,
            adder: interaction.user.id,
            adder_tag: interaction.user.tag,
            twitch_username: twitch_username,
            twitch_url: `https://www.twitch.tv/${twitch_username}`,
          };

          guild.streamers.push(new_data);

          fs.writeFile(
            "streamers.json",
            JSON.stringify(guilds),
            "utf-8",
            function (error) {
              if (error) {
                console.log(error);
              }
            }
          );

          return interaction.reply({
            content: `Your twitch has been added! When you will start a stream, I will send a notification on this server! (Your twitch is: <${new_data.twitch_url}>) ✅`,
            ephemeral: true,
          });
        } else {
          return interaction.reply({
            content:
              "Sorry but it seems that you already have a twitch linked to your id!\n(To change your twitch, simply use the /change_your_twitch command or if you want to delete it, use the /delete_your_twitch command!) ❌",
            ephemeral: true,
          });
        }
      } else {
        const twitch_username = interaction.options
          .getString("twitch_username")
          .toLocaleLowerCase();

        const new_data = {
          fetched: false,
          adder: interaction.user.id,
          adder_tag: interaction.user.tag,
          twitch_username: twitch_username,
          twitch_url: `https://www.twitch.tv/${twitch_username}`,
        };

        guild.streamers.push(new_data);

        fs.writeFile(
          "streamers.json",
          JSON.stringify(guilds),
          "utf-8",
          function (error) {
            if (error) {
              console.log(error);
            }
          }
        );

        return interaction.reply({
          content: `Your twitch has been added! When you will start a stream, I will send a notification on this server! (Your twitch is: <${new_data.twitch_url}>) ✅`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  if (interaction.commandName === "set_notification_channel") {
    try {
      if (!interaction.member.permissions.has(["ADMINISTRATOR"]))
        return interaction.reply({
          content: "You don't have permission to do this command! ❌",
          ephemeral: true,
        });

      const notification_channel = interaction.options.getChannel(
        "notification_channel"
      );

      guilds[interaction.guild.id] = {
        fetched: false,
        notification_channel: notification_channel.id,
        streamers: guilds[interaction.guild.id].streamers,
        admin_only: guilds[interaction.guild.id].admin_only,
      };

      fs.writeFile(
        "streamers.json",
        JSON.stringify(guilds),
        "utf-8",
        function (error) {
          if (error) {
            console.log(error);
          }
        }
      );

      return interaction.reply({
        content: `The notification channel is now: <#${notification_channel.id}>! ✅`,
        ephemeral: true,
      });
    } catch (error) {
      console.log(error);
    }
  }

  if (interaction.commandName === "change_your_twitch") {
    try {
      const guild = guilds[interaction.guild.id];

      let tries = -1;

      let already_exist = false;

      let streamer = null;

      if (guild.streamers.length > 0) {
        guild.streamers.map(async (data) => {
          tries = tries + 1;

          if (data.adder === interaction.user.id) {
            already_exist = true;

            streamer = data;
          }
        });

        if (already_exist === true && streamer.adder === interaction.user.id) {
          const twitch_username = interaction.options
            .getString("new_twitch_username")
            .toLocaleLowerCase();

          function removeItemOnce(arr, value) {
            var index = arr.indexOf(value);
            if (index > -1) {
              arr.splice(index, 1);
            }
            return arr;
          }

          await removeItemOnce(guild.streamers, streamer);

          async function verify_null(array) {
            let null_tries = 0;

            array.forEach(async (data) => {
              if (data === null || !data) {
                null_tries = null_tries++;
              }

              if (null_tries === array.length) {
                const new_array = array.filter((n) => n);

                return new_array;
              } else {
                return array.filter((n) => n);
              }
            });
          }

          await verify_null(guild.streamers);

          new_data = {
            fetched: streamer.fetched,
            adder: interaction.user.id,
            adder_tag: interaction.user.tag,
            twitch_username: twitch_username,
            twitch_url: `https://www.twitch.tv/${twitch_username}`,
          };

          guild.streamers.push(new_data);

          fs.writeFile(
            "streamers.json",
            JSON.stringify(guilds),
            "utf-8",
            function (error) {
              if (error) {
                console.log(error);
              }
            }
          );

          return interaction.reply({
            content: `Your twitch has been updated! When you will start a stream, I will send a notification on this server with your new username! (Your twitch is now: <${
              guild.streamers[guild.streamers.length - 1].twitch_url
            }>) ✅`,
            ephemeral: true,
          });
        } else {
          return interaction.reply({
            content:
              "Sorry but it seems that you don't have a twitch linked to your id!\n(To add your twitch, simply use the /add_your_twitch command!) ❌",
            ephemeral: true,
          });
        }
      } else {
        return interaction.reply({
          content:
            "Sorry but it seems that you don't have a twitch linked to your id!\n(To add your twitch, simply use the /add_your_twitch command!)",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  if (interaction.commandName === "your_twitch") {
    try {
      const guild = guilds[interaction.guild.id];

      let already_exist = false;

      let streamer = null;

      if (guild.streamers.length > 0) {
        guild.streamers.map(async (data) => {
          if (data.adder === interaction.user.id) {
            already_exist = true;

            streamer = data;
          }
        });

        if (already_exist === true) {
          return interaction.reply({
            content: `Your twitch is currently ${streamer.twitch_username} (<${streamer.twitch_url}>) ✅`,
            ephemeral: true,
          });
        } else {
          return interaction.reply({
            content:
              "Sorry but it seems that you don't have a twitch linked to your id!\n(To add your twitch, simply use the /add_your_twitch command!) ❌",
            ephemeral: true,
          });
        }
      } else {
        return interaction.reply({
          content:
            "Sorry but it seems that you don't have a twitch linked to your id!\n(To add your twitch, simply use the /add_your_twitch command!) ❌",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  if (interaction.commandName === "delete_your_twitch") {
    try {
      const guild = guilds[interaction.guild.id];

      let tries = -1;

      let already_exist = false;

      let streamer = null;

      if (guild.streamers.length > 0) {
        guild.streamers.map(async (data) => {
          tries = tries + 1;

          if (data.adder === interaction.user.id) {
            already_exist = true;

            streamer = data;
          }
        });

        if (already_exist === true && streamer.adder === interaction.user.id) {
          function removeItemOnce(arr, value) {
            var index = arr.indexOf(value);
            if (index > -1) {
              arr.splice(index, 1);
            }
            return arr;
          }

          await removeItemOnce(guild.streamers, streamer);

          async function verify_null(array) {
            let null_tries = 0;

            array.forEach(async (data) => {
              if (data === null || !data) {
                null_tries = null_tries++;
              }

              if (null_tries === array.length) {
                const new_array = array.filter((n) => n);

                return new_array;
              } else {
                return array.filter((n) => n);
              }
            });
          }

          await verify_null(guild.streamers);

          fs.writeFile(
            "streamers.json",
            JSON.stringify(guilds),
            "utf-8",
            function (error) {
              if (error) {
                console.log(error);
              }
            }
          );

          return interaction.reply({
            content: `Your twitch has been deleted! ✅\n(If you want to recreate one, use the /add_your_twitch command)`,
            ephemeral: true,
          });
        } else {
          return interaction.reply({
            content:
              "Sorry but it seems that you don't have a twitch linked to your id!\n(To add your twitch, simply use the /add_your_twitch command!) ❌",
            ephemeral: true,
          });
        }
      } else {
        return interaction.reply({
          content:
            "Sorry but it seems that you don't have a twitch linked to your id!\n(To add your twitch, simply use the /add_your_twitch command!)",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  if (interaction.commandName === "change_the_twitch_of_a_member") {
    try {
      if (!interaction.member.permissions.has(["ADMINISTRATOR"]))
        return interaction.reply({
          content: "You don't have permission to do this command! ❌",
          ephemeral: true,
        });

      const user = interaction.options.getMember("user");

      const guild = guilds[interaction.guild.id];

      let tries = -1;

      let already_exist = false;

      let streamer = null;

      if (guild.streamers.length > 0) {
        guild.streamers.map(async (data) => {
          tries = tries + 1;

          if (data.adder === user.id) {
            already_exist = true;

            streamer = data;
          }
        });

        if (already_exist === true && streamer.adder === user.id) {
          const twitch_username = interaction.options
            .getString("new_twitch_username")
            .toLocaleLowerCase();

          function removeItemOnce(arr, value) {
            var index = arr.indexOf(value);
            if (index > -1) {
              arr.splice(index, 1);
            }
            return arr;
          }

          await removeItemOnce(guild.streamers, streamer);

          async function verify_null(array) {
            let null_tries = 0;

            array.forEach(async (data) => {
              if (data === null || !data) {
                null_tries = null_tries++;
              }

              if (null_tries === array.length) {
                const new_array = array.filter((n) => n);

                return new_array;
              } else {
                return array.filter((n) => n);
              }
            });
          }

          await verify_null(guild.streamers);

          new_data = {
            fetched: streamer.fetched,
            adder: user.id,
            adder_tag: user.tag,
            twitch_username: twitch_username,
            twitch_url: `https://www.twitch.tv/${twitch_username}`,
          };

          guild.streamers.push(new_data);

          fs.writeFile(
            "streamers.json",
            JSON.stringify(guilds),
            "utf-8",
            function (error) {
              if (error) {
                console.log(error);
              }
            }
          );

          return interaction.reply({
            content: `The twitch has been updated! ✅`,
            ephemeral: true,
          });
        } else {
          return interaction.reply({
            content:
              "Sorry but it seems that nobody is assigned to this user! ❌",
            ephemeral: true,
          });
        }
      } else {
        return interaction.reply({
          content:
            "Sorry but it seems that nobody is assigned to this user! ❌",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  if (interaction.commandName === "delete_the_twitch_of_a_member") {
    try {
      if (!interaction.member.permissions.has(["ADMINISTRATOR"]))
        return interaction.reply({
          content: "You don't have permission to do this command! ❌",
          ephemeral: true,
        });

      const user = interaction.options.getMember("user");

      const guild = guilds[interaction.guild.id];

      let tries = -1;

      let already_exist = false;

      let streamer = null;

      if (guild.streamers.length > 0) {
        guild.streamers.map(async (data) => {
          tries = tries + 1;

          if (data.adder === user.id) {
            already_exist = true;

            streamer = data;
          }
        });

        if (already_exist === true && streamer.adder === user.id) {
          function removeItemOnce(arr, value) {
            var index = arr.indexOf(value);
            if (index > -1) {
              arr.splice(index, 1);
            }
            return arr;
          }

          await removeItemOnce(guild.streamers, streamer);

          async function verify_null(array) {
            let null_tries = 0;

            array.forEach(async (data) => {
              if (data === null || !data) {
                null_tries = null_tries++;
              }

              if (null_tries === array.length) {
                const new_array = array.filter((n) => n);

                return new_array;
              } else {
                return array.filter((n) => n);
              }
            });
          }

          await verify_null(guild.streamers);

          fs.writeFile(
            "streamers.json",
            JSON.stringify(guilds),
            "utf-8",
            function (error) {
              if (error) {
                console.log(error);
              }
            }
          );

          return interaction.reply({
            content: `The twitch has been deleted! ✅`,
            ephemeral: true,
          });
        } else {
          return interaction.reply({
            content:
              "Sorry but it seems that nobody is assigned to this user! ❌",
            ephemeral: true,
          });
        }
      } else {
        return interaction.reply({
          content:
            "Sorry but it seems that nobody is assigned to this user! ❌",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.log(error);
    }
  } else if (interaction.commandName === "set_admin_only") {
    try {
      if (!interaction.member.permissions.has(["ADMINISTRATOR"]))
        return interaction.reply({
          content: "You don't have permission to do this command! ❌",
          ephemeral: true,
        });

      const guild = guilds[interaction.guild.id];

      if (guild.admin_only === false) {
        guilds[interaction.guild.id] = {
          fetched: guilds[interaction.guild.id].fetched,
          notification_channel:
            guilds[interaction.guild.id].notification_channel,
          streamers: guilds[interaction.guild.id].streamers,
          admin_only: true,
        };

        fs.writeFile(
          "streamers.json",
          JSON.stringify(guilds),
          "utf-8",
          function (error) {
            if (error) {
              console.log(error);
            }
          }
        );

        return interaction.reply({
          content: `The "admin_only" mode is enabled! ✅`,
          ephemeral: true,
        });
      } else {
        guilds[interaction.guild.id] = {
          fetched: guilds[interaction.guild.id].fetched,
          notification_channel:
            guilds[interaction.guild.id].notification_channel,
          streamers: guilds[interaction.guild.id].streamers,
          admin_only: false,
        };

        fs.writeFile(
          "streamers.json",
          JSON.stringify(guilds),
          "utf-8",
          function (error) {
            if (error) {
              console.log(error);
            }
          }
        );

        return interaction.reply({
          content: `The "admin_only" mode is disabled! ❌`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }
});

client.login(token);
