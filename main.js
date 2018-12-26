var fs = require('fs');

//A JSON file with the ClientID, ClientSecret, and Token
var info = JSON.parse(fs.readFileSync('info.json', 'utf-8'));

//The Discord.JS API
const Discord = require('discord.js');

//A Discord User Client (Bot)
const client = new Discord.Client();

//Used to stream audio from Youtube videos
const ytdl = require('ytdl-core');

//Used to help filter messages the bot doesn't need to further process
const cmdIdentifier = '!';

//The current Voice Channel
var connection;
//Whether or not the player is currently playing
var finished = true;
//The audio player
var dispatcher;

//A queue of requested songs
var queue = new Array();

//On successful login
client.on('ready', () => {
    console.log(`\n\n\nLogged in as ${client.user.tag}!`);
});


//Deletes messages from the channel that the command was posted in
function purge(msg, command, args) {
    //Get all of the messages in the channel, and delete however many the user specified - Up to 100
    msg.channel.fetchMessages({ limit : parseInt(args[0]) }).then(messages => {
        var filteredMessages = messages.filter(message => !message.pinned)
        filteredMessages.deleteAll();
    }).catch(console.error);
}


//Posts an embed that lists all the commands that the bot can do and what they do.
function help(msg, command, args){
    msg.channel.send({embed: {

        author: {
            icon_url: client.user.avatarURL
        },
        fields: [{

            name: "!help",
            value: "Display a list of the commands, how to use them, and a description of what they do."

        },

        {

            name: "!purge [number of messages -- optional]",
            value: "Delete up to 100 messages from the channel this is called in. If no argument is provided, then it will delete up to 100 messages."

        },

        {

            name: "!ping",
            value: "The bot replies \"pong\". Mostly used to test if the bot is working... or if you're bored."

        },

        {

            name: "!play [Youtube Link]",
            value: "The bot will join the Voice Channel you are in and stream the video audio."

        },
        {

            name: "!skip",
            value: "The bot will skip the current song and either move on to the next one in queue, or will leave the channel if there isn't one."

        }
    ]

    }});
}

//Replies pong.
function ping(msg, command, args){
    msg.reply("pong");
}


//Queues a Youtube URL, join's the voice channel of the user who called it, and plays the Youtube Video's audio.
function play(msg, command, args){

    //The channel the user who called the command is in. undefined if user is not in a channel
    var channel = msg.member.voiceChannel;

    //Check if the user is in a voice channel before trying to connect, and that the channel (if existing) is joinable.
    if(!channel || !channel.joinable){
        msg.reply("You must be in a joinable voice channel to use this command.");
    }

    //Causes the bot to join the channel the user is in

    //Add their request to the queue.
    queue.push(args[0]);

    //If the connection is ever undefined or null, then it's not in a channel, and therefore is safe to join the user's channel
    if(connection === undefined || connection === null){
        //Get the request from the Queue.
        var request = queue.shift();
        streamSong(request, channel, msg);

    } else{
        console.log(connection + "," + dispatcher);
    }

}

//Ends the current Dispatcher stream if it's currently running.
function skip(msg){
    if((dispatcher !== undefined) || (dispatcher != null)){
        dispatcher.end();
    } else {
        msg.reply("A song needs to be in queue to skip.");
    }
}

function streamSong(request, channel, msg){
//Join the user's channel
        connection = channel.join().then(conn =>{
            //Get the audio stream from Youtube
            const stream = ytdl(request, {filter: 'audioonly'});
            stream.on('error', console.error);
            //Play the stream to the user.
            dispatcher = conn.playStream(stream, {seek: 0, volume: 1});
            finished = false;
            //When the Dispatcher finishes playing a stream
            dispatcher.on('end',() => {

                //If the queue isn't empty, play the next song, otherwise leave the channel
                if(queue.length > 0){
                    streamSong(queue.shift(), channel);
                } else {
                    channel.leave();

                    //Reset the connection and dispatcher vars.
                    connection = null;
                    dispatcher = null;
                }
            });

        });
}

function songRequestError(request, channel, msg){
    msg.reply("Error requesting song.");
    channel.leave();
}

//Whenever a user posts a message to a channel
client.on('message', msg => {

    //Return if Message is not from a server (Guild) text channel
    if(!msg.guild) return;

    //We would ignore case sensitivity across the board, BUT Youtube Identifiers (the part of the link after ?v=) are in Base64, meaning case matters.
    //As a result, Case sensitivity will be on a per-command basis instead of right off the bat.
    var input = msg.content;

    //Check if the message starts with the command identifier
    if(!input.startsWith(cmdIdentifier)) return;

    //This gives us a command and an args system.
    //So a message to the bot looks like !command arg1 arg2 arg3
    var args = input.slice(cmdIdentifier.length).trim().split(/ +/g);

    var command = args.shift().toLowerCase();

    switch(command){
        case 'purge':
            purge(msg, command, args);
            break;
        case 'help':
            help(msg, command, args);
            break;
        case 'ping':
            ping(msg, command, args);
            break;
        case 'play':
            play(msg, command, args);
            break;
        case 'skip':
            skip(msg);
            break;
    }
});


client.login(info["token"]);
