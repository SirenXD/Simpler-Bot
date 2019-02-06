var fs = require('fs');

//A JSON file with the ClientID, ClientSecret, and Token
var info = JSON.parse(fs.readFileSync('info.json', 'utf-8'));

//The Discord.JS API
const Discord = require('discord.js');

//A Discord User Client (Bot)
const client = new Discord.Client();

//Used to stream audio from Youtube videos
const ytdl = require('ytdl-core');

//Used to get individual videos from a playlist URL
const ytlist = require('youtube-playlist');
//Used to get access to the Spotify Web API
const Spotify = require('spotify-web-api-node');
var spotifyAPI;

//Used to search for Youtube videos by relevant spotify information.
const ytSearch = require("youtube-search");

//Used to help filter messages the bot doesn't need to further process
const cmdIdentifier = '!';

//Whether or not the player is currently playing
var finished = true;

//A queue of requested songs
var queue = new Array();

//A list of Guilds the bot is on.
var servers = new Array();

//On successful login
client.on('ready', () => {
    console.log(`\n\n\nLogged in as ${client.user.tag}!`);
    //Add all connected Guilds to an Array
    for(let i = 0; i < client.guilds.array().length; i++){
        servers.push(new Server(client.guilds.array()[i]));
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

function getServerByGuild(g){
    for(let i = 0; i < servers.length; i++){
        if(servers[i].Guild.id == g.id){
            return servers[i];
        }
    }
}

//Deletes messages from the channel that the command was posted in
function purge(msg, args) {
    getServerByGuild(msg.channel.guild).purge(msg.channel, parseInt(args[0]));
}

function join(msg){
    getServerByGuild(msg.channel.guild).join(msg, msg.member.voiceChannel);
}

function leave(msg){
    getServerByGuild(msg.channel.guild).leave();
}

//Posts an embed that lists all the commands that the bot can do and what they do.
function help(msg){
    getServerByGuild(msg.channel.guild).help(msg.channel);
}

//Replies pong.
function ping(msg, args){
    msg.reply("pong");
}


//Queues a Youtube URL, join's the voice channel of the user who called it, and plays the Youtube Video's audio.
function play(msg, args){
    //Used to filter Youtube Search results.
    var opts = {key: info["ytAPIKey"], type: 'video', maxResults: '1'};

    //If it's a Spotify Playlist
    if(args[0].includes("/playlist/")){
        //Remove some extra unnecessary data
        if(args[0].includes("?si=")){
            args[0] = args[0].slice(0, args[0].indexOf("?si="));
        }

        //Get the Spotify URI of the Playlist
        args[0] = args[0].slice(args[0].indexOf("/playlist/") + "/playlist/".length, args[0].length);

        //Get a list of tracks from the playlist
        let trackList = spotifyAPI.getPlaylist(args[0]).then( data => {
            console.log("Looping to play tracks...");
            //Loop through the tracks
            for(let i = 0; i < data.body.tracks.items.length; i++){

                console.log(data.body.tracks.items[i].track.name + " " + data.body.tracks.items[i].track.album.name);

                //Search Youtube for hopefully a close match to the song.
                ytSearch(data.body.tracks.items[i].track.name + " " + data.body.tracks.items[i].track.album.name, opts).then((result, err) =>{
                    if(err){
                        console.log(err);
                        msg.reply("The Youtube-API request quota was probably reached. I can't do anything about that. Sorry :frowning:");
                        return;
                    }

                    //The Youtube URL chosen
                    url = result.results[0].link;
                    console.log("From Youtube, requesting: " + url);

                    //If a song is currently playing
                    if(!getServerByGuild(msg.channel.guild).isPlaying()){
                        play(msg, [url]);
                    } else {
                        getServerByGuild(msg.channel.guild).addToQueue([url]);
                    }
                }).catch((e) => {
                    msg.reply("Something's wrong with the Youtube API!");
                    console.log("YT Search:" + args[0]);
                });
            }

        }).catch((e) => {
            msg.reply("Something is wrong with the Spotify API!");
            console.log("Spotify Playlist URI: " + args[0]);
        });
        return;
    }

    //If the request is a single Spotify URL
    if(args[0].includes("spotify.com/track/")){

        //Clean it up
        if(args[0].includes("?si=")){
            args[0] = args[0].slice(0, args[0].indexOf("?si="));
        }

        //Get the Spotify URI
        args[0] = args[0].slice(args[0].indexOf("track/") + "track/".length, args[0].length);

        //Get specific track information
        let track = spotifyAPI.getTrack(args[0]).then(data =>{
            console.log("From Spotify, requesting: " + data.body.name + " " + data.body.album.name);

            //Search Youtube for (hopefully) a close match.
            ytSearch(data.body.name + " " + data.body.album.name, opts).then((result, err) =>{
                if(err){
                    console.log(err);
                    msg.reply("The Youtube-API request quota was probably reached. I can't do anything about that. Sorry :frowning:");
                    return;
                }

                req = new Array();
                req.push(result.results[0].link);
                console.log("From Youtube, requesting: " + req);

                //Request the song as a Youtube URL
                play(msg, req);
            }).catch((e) => {
                msg.reply("Something's wrong with the Youtube API!");
                console.log("YT Search:" + args[0]);
            });;
        }).catch((e) => {
            msg.reply("Something is wrong with the Spotify API!");
            console.log("Spotify Track URI: " + args[0]);
        });;
        return;
    }
    //If the Request is a Playlist we need to get all of the individual URLs
    if(args[0].includes("&list=")){
        ytlist(args[0], 'url').then(res =>{
            //An Array to store all the individual URLs
            reqs = new Array();

            //Populate the Array with individual Youtube video URLs
            reqs = reqs.concat(res.data.playlist);

            //Play the first song in the array
            getServerByGuild(msg.channel.guild).play(msg, msg.member.voiceChannel, reqs.shift());
            //Add the rest to the Queue
            getServerByGuild(msg.channel.guild).addToQueue(reqs);
        });
        //If it's not a Playlist we can just treat it as 1 song and play it like normal
    } else {
        getServerByGuild(msg.channel.guild).play(msg, msg.member.voiceChannel, args[0]);
    }
}

//Calls Dispatcher.end() which either plays the next song or leaves the current voice channel
function skip(msg, args){

    //Check if there are any args
    if(args !== null || args !== undefined){
        //If there are, make sure it's a number OR the word 'all'
        if(parseInt(args[0]) == NaN && args[0].toLowerCase() != "all"){
            //If they're not a number we can't skip any songs so just return.
            msg.reply("You must pass in a number of songs to be skipped.");
            return;
        }
    }

    //If all is good, skip some songs
    getServerByGuild(msg.channel.guild).skip(msg, args[0], "This shouldn't ever show up.");
}

function changeVolume(msg, args){
    //Check if there are any args
    if(args !== null || args !== undefined){
        //If there are, make sure it's a number
        if(parseInt(args[0]) == NaN){
            //If they're not a number we can't change the volume to it.
            msg.reply("You must pass in a number between 0.1 or 1.0 or nothing to see the current volume.");
            return;
        }
    }

    getServerByGuild(msg.channel.guild).changeVolume(msg, args[0]);
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
            purge(msg, args);
            break;
        case 'help':
            help(msg);
            break;
        case 'ping':
            ping(msg);
            break;
        case 'play':
            play(msg, args);
            break;
        case 'skip':
            skip(msg, args);
            break;
        case 'join':
            join(msg);
            break;
        case 'leave':
            leave(msg);
            break;
        case 'volume':
            changeVolume(msg, args);
    }
});

client.login(info["disToken"]);


class Server{

    constructor (g){
        //A server that the bot is connected to
        this.guild = g;
        //A list of queued songs to play
        this.queue = new Array();
        //The current Voice channel the bot is in on this server
        this.connection = null;
        //The volume of the audio stream
        this.volume = 1.0;
        //
        this.playing = false;
    }

    get Guild(){
        return this.guild;
    }

    isPlaying(){
        return this.playing;
    }

    purge(channel, numMsgs){
        channel.fetchMessages({ limit : numMsgs}).then(messages => {
            var filteredMessages = messages.filter(message => !message.pinned)
            filteredMessages.deleteAll();
        }).catch(console.error);
    }

    help(channel){
        channel.send({embed: {

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

                name: "!skip [Number of songs to skip, or the word \"all\" -- optional]",
                value: "The bot will skip the current song and move on to the next one, will skip a number of songs, or will skip all the songs. If the queue is empty, the bot will leave the channel."

            },
            {

                name: "!volume [Number between 0.1 and 1.0]",
                value: "Changes the volume of the songs the bot plays for all users. This is independent of the volume set on your Discord client. If no argument is provided it will return the current volume."

            }
        ]

        }});
    }

    changeVolume(msg, val){
        if(val !== null && val !== undefined){
            //Clamping the volume
            if(val > 1.0){
                val = 1.0;
            } else if (val < 0.1){
                val = 0.1;
            }

            this.volume = val;
        } else {
            msg.reply("The volume is currently set to " + this.volume * 100 + "%.")
        }
    }

    join(msg, channel){
        this.connection = channel;

        if(!channel || !channel.joinable){
            msg.reply("You must be in a joinable voice channel to use this command.");
            return;
        }

        return channel.join();
    }

    leave(){
        this.connection.leave();
        this.connection = null;
        this.playing = false;
    }

    play(msg, channel, req){
        this.queue.push(req);
        this.playing = true;

        //If the connection is ever undefined or null, then it's not in a channel, and therefore is safe to join the user's channel
        if(this.connection === undefined || this.connection === null){
            //Get the request from the Queue.
            var request = this.queue.shift();
            this.streamSong(msg, channel, req);

        }

    }

    addToQueue(reqs){
        this.queue = this.queue.concat(reqs);
    }

    streamSong(msg, channel, req){

            this.join(msg, channel).then(conn =>{
                //Get the audio stream from Youtube
                const stream = ytdl(req, {filter: 'audioonly'});
                stream.on('error', e => {
                    msg.reply("There was something wrong with the song request");
                    console.log(e);
                    this.leave();
                });
                //Play the stream to the user.
                this.dispatcher = conn.playStream(stream, {seek: 0, volume: this.volume});
                //When the Dispatcher finishes playing a stream
                this.dispatcher.on('end',() => {
                    //If the queue isn't empty, play the next song, otherwise leave the channel
                    console.log(this.queue);
                    if(this.queue.length > 0){
                        this.streamSong(msg, channel, this.queue.shift());
                    } else {
                        this.leave();
                    }
                });

            }).catch(e => {
                msg.reply("There was something wrong with the dispatcher");
                console.log(e);
                if(this.queue.length > 0){
                    this.streamSong(msg, channel, this.queue.shift());
                } else {
                    this.leave();
                }
            });
    }

    skip(msg, numSkip, errMsg){
        if((this.dispatcher !== undefined) || (this.dispatcher != null)){
            //If it's a string, then the only passable String allowed here is 'all', so we just empty the queue
            if(numSkip == "all"){
                this.queue.splice(0, this.queue.length-1);
            } else if(numSkip !== undefined){
                numSkip = parseInt(numSkip);
                //Check if the amount to be skipped doesn't exceed the Array length otherwise just empty the queue
                if(numSkip <= this.queue.length){
                    this.queue.splice(0, numSkip);
                } else if(numSkip > this.queue.length){
                    this.queue.splice(0, this.queue.length-1);
                }
            }
            this.dispatcher.end();
        } else {
            msg.reply(errMsg);
            console.log("Someone probably skipped before the dispatcher loaded.");
        }
    }
}
