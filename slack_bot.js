/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node slack_bot.js

# USE THE BOT:

  Find your bot inside Slack to send it a direct message.

  Say: "Hello"

  The bot will reply "Hello!"

  Say: "who are you?"

  The bot will tell you its name, where it is running, and for how long.

  Say: "Call me <nickname>"

  Tell the bot your nickname. Now you are friends.

  Say: "who am I?"

  The bot will tell you your nickname, if it knows one for you.

  Say: "shutdown"

  The bot will ask if you are sure, and then shut itself down.

  Make sure to invite your bot into other channels using /invite @<my bot>!

# EXTEND THE BOT:

  Botkit has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var redis = require('redis');
var nodemailer = require('nodemailer');
var client = redis.createClient(process.env.REDISCLOUD_URL, {no_ready_check: true});
var Botkit = require('./lib/Botkit.js');
var os = require('os');
var gamingnews = [];
var technews = [];
var transporter = nodemailer.createTransport('smtps://techraptorclevergirl%40gmail.com:clevergirl4techraptor@smtp.gmail.com');

var controller = Botkit.slackbot({
    debug: true
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();


controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});


//controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {
//
//    bot.startConversation(message, function(err, convo) {
//
//        convo.ask('Are you sure you want me to shutdown?', [
//            {
//                pattern: bot.utterances.yes,
//                callback: function(response, convo) {
//                    convo.say('Bye!');
//                    convo.next();
//                    setTimeout(function() {
//                        process.exit();
//                    }, 3000);
//                }
//            },
//        {
//            pattern: bot.utterances.no,
//            default: true,
//            callback: function(response, convo) {
//                convo.say('*Phew!*');
//                convo.next();
//            }
//        }
//        ]);
//    });
//});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

controller.hears(['^!addgaming (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	var news = message.match[1];
	
	if(news != undefined && news !=null && news != ''){

		client.rpush(['gaming', news]);
		
		bot.reply(message, 'Your scoop has been added :scoop:');
	}
	
});

controller.hears(['^!claimgaming (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	var news = message.match[1];
	
	if(typeof news !== 'undefined' && news !=null && news != ''){
		client.lrange('gaming', 0, -1, function(err, reply) {
			bot.startPrivateConversation(message,function(err,convo) {

				for (var i = 0; i < reply.length; i++) {
			  
					if (reply[i].substring(0, news.length) == news) {

						bot.reply(message, 'The scoop :scoop: ' + reply[i] + ' has been claimed');
						convo.say(
							{
								text: 'Here is the news story you claimed: \n' + removeLinkFormatting(reply[i]),
								channel: message.user
							}
						);
						client.lset('gaming', i, 'claimed');
					}
				}
			});		
		});
	}

});

controller.hears(['^!viewgaming'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    	
	client.lrange('gaming', 0, -1, function(err, reply) {
		
		if (typeof reply !== 'undefined' && reply.length > 0 && !allclaimed(reply)) {
			
			bot.reply(message, 'Unclaimed stories incoming in your inbox!');

			bot.startPrivateConversation(message,function(err,convo) {

				for (var i = 0; i < reply.length; i++) {
				
				  if(reply[i] != 'claimed'){
						convo.say(
							{
								text: removeLinkFormatting(reply[i]),
								channel: message.user
							}
						);
					}
				}
			});		
		}else{
			bot.reply(message, 'There are no stories left in the backlog');
		}
		
	});

});

controller.hears(['^!cleargaming'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    	
	client.lrange('gaming', 0, -1, function(err, reply) {
			
		bot.startPrivateConversation(message,function(err,convo) {
			
		for (var i = 0; i < reply.length; i++) {
		  if(reply[i] != 'claimed'){
				convo.say(
					{
						text: removeLinkFormatting(reply[i]),
						channel: message.user
					}
				);
				
			}
		  }
		});
	 });

	  client.del('gaming');
	  
	  bot.reply(message, 'The gaming news database has been cleaned!');
	
});


controller.hears(['^!addtech (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	var news = message.match[1];
	
	if(news != undefined && news !=null && news != ''){

		client.rpush(['tech', news]);
		
		bot.reply(message, 'Your scoop has been added :scoop:');
	}
	
});

controller.hears(['^!claimtech (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	var news = message.match[1];
	
	if(typeof news !== 'undefined' && news !=null && news != ''){
		client.lrange('tech', 0, -1, function(err, reply) {
			bot.startPrivateConversation(message,function(err,convo) {

				for (var i = 0; i < reply.length; i++) {
			  
					if (reply[i].substring(0, news.length) == news) {

						bot.reply(message, 'The scoop :scoop: ' + reply[i] + ' has been claimed');
						convo.say(
							{
								text: 'Here is the news story you claimed: \n' + removeLinkFormatting(reply[i]),
								channel: message.user
							}
						);
						client.lset('tech', i, 'claimed');
					}
				}
			});		
		});
	}

});

controller.hears(['^!viewtech'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    	
	client.lrange('tech', 0, -1, function(err, reply) {
		
		if (typeof reply !== 'undefined' && reply.length > 0 && !allclaimed(reply)) {
			
			bot.reply(message, 'Unclaimed stories incoming in your inbox!');

			bot.startPrivateConversation(message,function(err,convo) {

				for (var i = 0; i < reply.length; i++) {
				
				  if(reply[i] != 'claimed'){
						convo.say(
							{
								text: removeLinkFormatting(reply[i]),
								channel: message.user
							}
						);
					}
				}
			});		
		}else{
			bot.reply(message, 'There are no stories left in the backlog');
		}
		
	});

});

controller.hears(['^!cleartech'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    	
	client.lrange('tech', 0, -1, function(err, reply) {
			
		bot.startPrivateConversation(message,function(err,convo) {
			
		for (var i = 0; i < reply.length; i++) {
		  if(reply[i] != 'claimed'){
				convo.say(
					{
						text: removeLinkFormatting(reply[i]),
						channel: message.user
					}
				);
				
			}
		  }
		});
	 });

	  client.del('tech');
	  
	  bot.reply(message, 'The technology news database has been cleaned!');
	
});

controller.hears(['^!setdigest (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    	
	var digest = message.match[1];

	client.set('digest',digest);
	
	bot.reply(message, 'New digest set!');
		
});

controller.hears(['^!digest'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
	
	client.get("digest", function(err, value) {
		var toPrint = removeLinkFormatting(value);
	
		setTimeout(bot.reply(message, 'Current digest: ' + toPrint),1000);
    });
			
});

controller.hears(['^!mailmegaming (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
	
	var toSend = '';
	var mailaddress = message.match[1];
	
	client.lrange('gaming', 0, -1, function(err, reply) {
		
		if (typeof reply !== 'undefined' && reply.length > 0 && !allclaimed(reply)) {
			
			bot.reply(message, 'Unclaimed stories incoming in your email!');

			for (var i = 0; i < reply.length; i++) {
			
			  if(reply[i] != 'claimed'){
				  toSend = toSend + '\n' + removeLinkFormatting(reply[i]);
				}
			}
			
			var mailOptions = {
				from: '"Clever Girl" <techraptorclevergirl@gmail.com>', // sender address
				to: mailaddress, // list of receivers
				subject: 'Gaming News List', // Subject line
				text: toSend, // plaintext body
				html: toSend // html body
			};
			transporter.sendMail(mailOptions, function(error, info){
				if(error){
					return console.log(error);
				}
				console.log('Message sent: ' + info.response);
			});
		}else{
			bot.reply(message, 'There are no stories left in the backlog');
		}
		
	});
			
});

function removeLinkFormatting(toCheck){
		
	var toReturn = toCheck;
		
	if(/\<(.*)\|(.*)\>/.test(toCheck)){
				
		var formattedLink = toCheck.match(/\<(.*)\|(.*)\>/);
								
		toReturn = toCheck.replace(/\<(.*)\|(.*)\>/,formattedLink[2]);
				
	}else if(/\<(.*)\>/.test(toCheck)){
		
		var formattedLink = toCheck.match(/\<(.*)\>/);
				
		toReturn = toCheck.replace(formattedLink[0], formattedLink[0].substring(1,formattedLink[0].length-1));
	}
	
	return toReturn;
	
};


controller.hears(['help'], 'direct_message,direct_mention,mention', function(bot, message) {
	
	var text = 'You can give me these commands:\n' +
	'@clevergirl hello/hi: hello to you :) \n'+
	'@clevergirl call me [nickname]/my name is [nickname]: I will remember your nickname \n'+
	'@clevergirl what is my name/who am i: I will tell you your nickname \n'+
	'@clevergirl uptime/identify yourself/who are you/what is your name: I will tell you about me \n'+
	'@clevergirl help: show list of commands \n'+
	'!addgaming [text]: adds [text] to the unclaimed gaming news database. \n '+
	'!claimgaming [text]: sends to your slack inbox all the unclaimed gaming news that start with [text] and removes them from database \n'+
	'!viewgaming: sends to your slack inbox all the unclaimed gaming news. Does NOT remove them from the database \n'+
	'!cleargaming: sends to your slack inbox all the unclaimed gaming news and removes them from the database \n'+
	'!addtech [text]: adds [text] to the unclaimed technology news database. \n '+
	'!claimtech [text]: sends to your slack inbox all the unclaimed technology news that start with [text] and removes them from database \n'+
	'!viewtech: sends to your slack inbox all the unclaimed technology news. Does NOT remove them from the database \n'+
	'!cleartech: sends to your slack inbox all the unclaimed technology news and removes them from the database \n' +
	'!setdigest: sets the new digest (replaces the old one) \n'+
	'!digest: I\'ll show you the current digest';

	bot.startPrivateConversation(message,function(err,convo) {		
		convo.say(
			{
				text: text,
				channel: message.user
			}
		);
	});
	
});

controller.hears(['^!view','^!claim (.*)','^!clear','^!add (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    	
	var text = 'You can give me these commands:\n' +
	'@clevergirl hello/hi: hello to you :) \n'+
	'@clevergirl call me [nickname]/my name is [nickname]: I will remember your nickname \n'+
	'@clevergirl what is my name/who am i: I will tell you your nickname \n'+
	'@clevergirl uptime/identify yourself/who are you/what is your name: I will tell you about me \n'+
	'@clevergirl help: show list of commands \n'+
	'!addgaming [text]: adds [text] to the unclaimed gaming news database. \n '+
	'!claimgaming [text]: sends to your slack inbox all the unclaimed gaming news that start with [text] and removes them from database \n'+
	'!viewgaming: sends to your slack inbox all the unclaimed gaming news. Does NOT remove them from the database \n'+
	'!cleargaming: sends to your slack inbox all the unclaimed gaming news and removes them from the database \n'+
	'!addtech [text]: adds [text] to the unclaimed technology news database. \n '+
	'!claimtech [text]: sends to your slack inbox all the unclaimed technology news that start with [text] and removes them from database \n'+
	'!viewtech: sends to your slack inbox all the unclaimed technology news. Does NOT remove them from the database \n'+
	'!cleartech: sends to your slack inbox all the unclaimed technology news and removes them from the database \n' +
	'!setdigest: sets the new digest (replaces the old one) \n'+
	'!digest: I\'ll show you the current digest';

	bot.startPrivateConversation(message,function(err,convo) {		
		convo.say(
			{
				text: text,
				channel: message.user
			}
		);
	});		
});


function allclaimed(list) {

    for(var i = 0; i < list.length; i++)
    {
        if(list[i] !== 'claimed')
            return false;
    }

    return true;
}

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
