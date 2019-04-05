//A list of the servers the bot is on
let servers = new Array();

//Used to get individual videos from a playlist URL
const ytlist = require('youtube-playlist');

//Used to search for Youtube videos by relevant spotify information.
const ytSearch = require("youtube-search");

//Used to add a server to the list of servers
function addServer(server){
    servers.push(server);
}

//Returns the server object by the Guild ID
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

//Joins the voice channel of the person who called it
function join(msg){
    getServerByGuild(msg.channel.guild).join(msg, msg.member.voiceChannel);
}

//Leaves the voice channel of the person who called it
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


//Gets a
function getSpotifyURI(url){
    if(url.includes("?si=")){
        url = url.slice(0, url.indexOf("?si="));
    }

    //Get the Spotify URI of the Playlist
    url = url.slice(url.indexOf("/playlist/") + "/playlist/".length, url.length);

    return url;
}

//Search Youtube for the Spotify track(S)
function searchForYoutube(tracks){
    for(let i = 0; i < tracks.length; i++){

        console.log(tracks[i].track.name + " " + tracks[i].track.album.name);

        //Search Youtube for hopefully a close match to the song.
        ytSearch(tracks[i].track.name + " " + tracks[i].track.album.name, opts).then((result, err) =>{
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
}

//Queues a Youtube URL, join's the voice channel of the user who called it, and plays the Youtube Video's audio.
function play(msg, args, key){
    //Used to filter Youtube Search results.
    var opts = {key: key, type: 'video', maxResults: '1'};

    //If it's a Spotify Playlist
    if(args[0].includes("/playlist/")){
        //Get the Spotify URI of the Playlist
        args[0] = getSpotifyURI(args[0]);

        //Get a list of tracks from the playlist
        let trackList = spotifyAPI.getPlaylist(args[0]).then( data => {
            console.log("Looping to play tracks...");
            //Loop through the tracks
            searchForYoutube(data.body.tracks.items);
        }).catch((e) => {
            msg.reply("Something is wrong with the Spotify API!");
            console.log("Spotify Playlist URI: " + args[0]);
        });
        return;
    }

    //If the request is a single Spotify URL
    if(args[0].includes("spotify.com/track/")){

        //Get the Spotify URI of the Track
        args[0] = getSpotifyURI(args[0]);

        //Get specific track information
        let track = spotifyAPI.getTrack(args[0]).then(data =>{
            console.log("From Spotify, requesting: " + data.body.name + " " + data.body.album.name);
            //Get & Request the approximate Youtube equivalent
            searchForYoutube([{track: data.body}]);
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


let commands = {
    purge, join, leave, help, ping, play, skip, changeVolume, addServer
};

module.exports = commands;
