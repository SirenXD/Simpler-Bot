var fs = require('fs');

//A JSON file with the ClientID, ClientSecret, and Token
var info = JSON.parse(fs.readFileSync('info.json', 'utf-8'));

//The Discord.JS API
const Discord = require('discord.js');

//A Discord User Client (Bot)
const client = new Discord.Client();

//Used to stream audio from Youtube videos
const ytdl = require('ytdl-core');

//Used to get access to the Spotify Web API
const Spotify = require('spotify-web-api-node');
var spotifyAPI;

const Server = require('./Server');

//Used to help filter messages the bot doesn't need to further process
const cmdIdentifier = '!';

//Whether or not the player is currently playing
let finished = true;

//A queue of requested songs
let queue = new Array();

let commands = require("./commands");

//On successful login
client.on('ready', () => {
    console.log(`\n\n\nLogged in as ${client.user.tag}!`);
    //Add all connected Guilds to an Array
    for(let i = 0; i < client.guilds.array().length; i++){
        console.log("ADDING A SERVER BTW");
        commands.addServer(new Server(client.guilds.array()[i]));
    }
    //Initialize the Spotify Web API
    spotifyAPI = new Spotify({
        clientId: info["spoClientID"],
        clientSecret: info["spoClientSecret"]
    });
    //Generate a Spotify Auth Token
    generateSpotifyAuthToken()
    //Generate a new one before the old one expires
    setTimeout(generateSpotifyAuthToken, 3420000);
});

function generateSpotifyAuthToken(){
    //Generate an Access Token
    spotifyAPI.clientCredentialsGrant().then(function(data){
        console.log('The access token is ' + data.body['access_token']);

        spotifyAPI.setAccessToken(data.body['access_token']);
    }, function(err){
        console.log("Couldn't generate an Auth Token for the Spotify Web API.")
    });
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
    //So a message to the bot looks like !command arg0 arg1 arg2
    var args = input.slice(cmdIdentifier.length).trim().split(/ +/g);

    var command = args.shift().toLowerCase();

    switch(command){
        case 'purge':
            commands.purge(msg, args);
            break;
        case 'help':
            commands.help(msg);
            break;
        case 'ping':
            commands.ping(msg);
            break;
        case 'play':
            commands.play(msg, args, info["ytAPIKey"]);
            break;
        case 'skip':
            commands.skip(msg, args);
            break;
        case 'join':
            commands.join(msg);
            break;
        case 'leave':
            commands.leave(msg);
            break;
        case 'volume':
            commands.changeVolume(msg, args);
    }
});

client.login(info["disToken"]);
