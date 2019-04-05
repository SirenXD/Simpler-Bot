
//Used to stream audio from Youtube videos
const ytdl = require('ytdl-core');

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

    help(channel, icon_url){
        channel.send({embed: {

            author: {
                icon_url: icon_url
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

module.exports = Server
