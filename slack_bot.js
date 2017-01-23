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
//var mg = require('nodemailer-mailgun-transport');
var client = redis.createClient(process.env.REDISCLOUD_URL, {no_ready_check: true});
var Botkit = require('./lib/Botkit.js');
var os = require('os');
var async = require('async');
var gamingnews = [];
var technews = [];

var transporter = nodemailer.createTransport('smtps://techraptorclevergirl%40yahoo.com:TechRaptorBot@smtp.mail.yahoo.com');

//var auth = {
//  auth: {
//    api_key: 'key-e83f3236aad7ce7a0d45d51d45de5ae6',
//    domain: 'sandboxad9fe307c5d64e09b4730761129a9fa7.mailgun.org'
//  }
//}

//var nodemailerMailgun = nodemailer.createTransport(mg(auth));

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
	
function addElement(key, element, bot, message) {
		
	if(element != undefined && element !=null && element != ''){

		var words = element.split(" ");
		
		for (var i = 0; i < words.length; i++) {
			
			if(/\<(.*)\>/.test(words[i])){
				words[i] = removeLinkFormatting(words[i]);
			}
			
		}
		
		client.rpush([key, words.join(" ")]);
		
		bot.reply(message, 'Your scoop has been added :scoop:');
	}
	
}


function claimElement(key, element, bot, message) {
	
	if(typeof element !== 'undefined' && element !=null && element != ''){
		client.lrange(key, 0, -1, function(err, reply) {
			bot.startPrivateConversation(message,function(err,convo) {

				for (var i = 0; i < reply.length; i++) {
			  
					if (reply[i].substring(0, element.length).toUpperCase() == element.toUpperCase()) {

						bot.reply(message, 'The scoop :scoop: ' + reply[i] + ' has been claimed');
						convo.say(
							{
								text: 'Here is the stuff you claimed: \n' + removeLinkFormatting(reply[i]),
								channel: message.user
							}
						);
						client.lset(key, i, 'claimed');
					}
				}
				
				//setTimeout(function(key, bot, message){
                //
				//	client.lrange(key, 0, -1, function(err, reply) {
				//			if(allclaimed(reply)){
				//				clearKey(key, bot, message);
				//			}
				//		}, 3000);
				//		
				//});

					
			});
			
		});
	}
	
}

function viewKey(key, bot, message) {
		
	var block = '';
	
	client.lrange(key.replace('alt', ''), 0, -1, function(err, reply) {
	
		
		if (typeof reply !== 'undefined' && reply.length > 0 && !allclaimed(reply)) {
			
			block += '*Incoming stuff in the ' + key.replace('alt', '') + ' category! *\n';
				
				for (var i = 0; i < reply.length; i++) {
				
				  if(reply[i] != 'claimed'){
					  
					  block += '*•* ' + removeLinkFormatting(reply[i]) + '\n';
					  
					}
				}

		}else{
			if(key !== 'scoopalt' && key !== 'priorityalt' && key !== 'storyalt' && key !== 'articlealt')
				bot.reply(message, 'There are no ' + key.replace('alt', '') + ' stories left in the backlog');
			block = 'empty';
		}
		
		if ( block !== 'empty' ) {
		
			if(key !== 'scoopalt' && key !== 'priorityalt' && key !== 'storyalt' && key !== 'articlealt')
				bot.reply(message, 'Incoming! Check your inbox.');
			
			if(key === 'article')
				bot.reply(message, 'Stories and articles incoming in your inbox!');

			bot.startPrivateConversation(message,function(err,convo) {

				convo.say(
					{
						text: block,
						channel: message.user
					}
				);
			});		
		}
		
	});		
		
}

function clearKey(key, bot, message) {

	client.lrange(key, 0, -1, function(err, reply) {
			
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
			client.del(key);
		
			bot.reply(message, 'The ' + key + ' is now empty!');
		});
		
	 });

}

function mailmeKey(key,mailaddress, bot, message) {

	var toSend = '<ul>';
	
	client.lrange(key, 0, -1, function(err, reply) {
		
		if (typeof reply !== 'undefined' && reply.length > 0 && !allclaimed(reply)) {
			
			bot.reply(message, 'Unclaimed stories incoming in your email!');

			for (var i = 0; i < reply.length; i++) {
			
			  if(reply[i] != 'claimed'){
				  toSend = toSend + '<li>' + removeLinkFormatting(reply[i]) + '</li>';
				}
			}
			toSend = toSend + '</ul>';
			var mailOptions = {
				from: '"Clever Girl" <techraptorclevergirl@yahoo.com>', // sender address
				to: removeLinkFormatting(mailaddress), // list of receivers
				subject: key + ' News', // Subject line
				html: toSend // html body
			};

		// send mail with defined transport object
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
}

controller.hears(['^!addgaming (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	addElement('gaming', message.match[1], bot, message);
	
});

controller.hears(['^!claimgaming (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('gaming', message.match[1], bot, message);
	
});

controller.hears(['^!viewgaming'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	viewKey('scoopalt', bot, message);	
	viewKey('priorityalt', bot, message);	
	viewKey('gaming', bot, message);

});

controller.hears(['^!cleargaming'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    	
	clearKey('gaming', bot, message);
		
});

controller.hears(['^!mailmegaming (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
	
	mailmeKey('gaming', message.match[1], bot, message);
	
});

controller.hears(['^!addtech (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
        
	addElement('tech', message.match[1], bot, message);	
	
});

controller.hears(['^!claimtech (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('tech', message.match[1], bot, message);

});

controller.hears(['^!viewtech'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
	
	viewKey('scoopalt', bot, message);	
	viewKey('priorityalt', bot, message);	
	viewKey('tech', bot, message);

});

controller.hears(['^!cleartech'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
	
	clearKey('tech', bot, message);
	
});

controller.hears(['^!mailmetech (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
	
	mailmeKey('tech', message.match[1], bot, message);
	
});

controller.hears(['^!addpriority (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
        
	addElement('priority', message.match[1], bot, message);	
	
});

controller.hears(['^!claimpriority (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('priority', message.match[1], bot, message);

});

controller.hears(['^!viewpriority'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	viewKey('priority', bot, message);	

});

controller.hears(['^!addscoop (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
        
	addElement('scoop', message.match[1], bot, message);	
	
});

controller.hears(['^!claimscoop (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('scoop', message.match[1], bot, message);

});

controller.hears(['^!viewscoops'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	viewKey('scoop', bot, message);	

});

controller.hears(['^!addarticle (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
        
	addElement('article', message.match[1], bot, message);	
	
});

controller.hears(['^!claimarticle (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('article', message.match[1], bot, message);

});

controller.hears(['^!addguide (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
        
	addElement('guide', message.match[1], bot, message);	
	
});

controller.hears(['^!deleteguide (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('guide', message.match[1], bot, message);

});

controller.hears(['^!viewguides'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	viewKey('guide', bot, message);	

});

controller.hears(['^!addstory (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
        
	addElement('story', message.match[1], bot, message);	
	
});

controller.hears(['^!claimstory (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('story', message.match[1], bot, message);

});

controller.hears(['^!viewstories'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	viewKey('story', bot, message);	

});

controller.hears(['^!addgamepage (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
        
	addElement('gamepage', message.match[1], bot, message);	
	
});

controller.hears(['^!claimgamepage (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('gamepage', message.match[1], bot, message);

});

controller.hears(['^!viewgamepages'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	viewKey('gamepage', bot, message);	

});

controller.hears(['^!viewarticles'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	viewKey('article', bot, message);
	viewKey('storyalt', bot, message);

});

controller.hears(['^!addquicklink (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	addElement('quicklink', message.match[1], bot, message);
	
});

controller.hears(['^!removequicklink (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	claimElement('quicklink', message.match[1], bot, message);
	
});

controller.hears(['^!viewquicklinks'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	viewKey('quicklink', bot, message);

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

controller.hears(['^!mailmeall (.*)'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
	
	var toSend = '';
	var mailaddress = message.match[1];
	
	client.lrange('gaming', 0, -1, function(err, reply) {
		
		if (typeof reply !== 'undefined' && reply.length > 0 && !allclaimed(reply)) {
			
			toSend = '<b>GAMING NEWS:</b> <br><ul>';
						
			for (var i = 0; i < reply.length; i++) {
			
			  if(reply[i] != 'claimed'){
				  toSend = toSend + '<li>' + removeLinkFormatting(reply[i]) + '</li>';
				}
			}
			toSend = toSend + '</ul>';

		}
		client.lrange('tech', 0, -1, function(err, reply) {
		
			if (typeof reply !== 'undefined' && reply.length > 0 && !allclaimed(reply)) {
				
				toSend = toSend + '<br><b>TECHNOLOGY NEWS:</b> <br><ul>';
				
				for (var i = 0; i < reply.length; i++) {
					
				  if(reply[i] != 'claimed'){
					  toSend = toSend + '<li>' + removeLinkFormatting(reply[i]) + '</li>';
					}
				}
				toSend = toSend + '</ul>';
			}
			if(toSend.length > 0){
				bot.reply(message, 'Unclaimed stories incoming in your email!');
				var mailOptions = {
					from: '"Clever Girl" <techraptorclevergirl@yahoo.com>', // sender address
					to: removeLinkFormatting(mailaddress), // list of receivers
					subject: 'Unclaimed News', // Subject line
					html: toSend // html body
				};
				
				// send mail with defined transport object
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

controller.hears(['^!clearall'], 'direct_message,direct_mention,mention,ambient', function(bot, message) {
    
	clearKey('gaming', bot, message);
	setTimeout(function(){clearKey('tech', bot, message)}, 3000);

});

controller.hears(['help'], 'direct_message,direct_mention,mention', function(bot, message) {
	
	var text = 'You can give me these commands:\n' +
				'*basic commands*\n' +
				'@clevergirl hello/hi: hello to you :)' +
				'@clevergirl call me [nickname]/my name is [nickname]: I will remember your nickname\n' +
				'@clevergirl what is my name/who am i: I will tell you your nickname\n' +
				'@clevergirl uptime/identify yourself/who are you/what is your name: I will tell you about me\n' +
				'@clevergirl help: show list of commands\n' +
				'*Viewing Items to be Written - sent to you via PM’s*\n' +
				'!viewgaming: sends all the unclaimed gaming news including priority and scoops. Does NOT remove them from the database\n' +
				'!viewtech: sends all the unclaimed technology news including priority and scoop. Does NOT remove them from the database\n' +
				'!viewarticles: sends all the stories and articles to be written. Does NOT remove them from the database\n' +
				'!viewguides: sends the list of guides to be written. Does NOT remove them from the database\n' +
				'!viewgamepages: sends the list of Game Pages that need to be created. Does NOT remove them from the database\n' +
				'!viewscoops: sends the list of scoops that need to be covered. Does NOT remove them from the database\n' +
				'!viewpriority: sends the list of priority stories that need to be covered. Does NOT remove them from the database\n' +				
				'!viewpriority: sends the list of other stories that need to be covered. Does NOT remove them from the database\n' +				
				'!mailmegaming [email]: sends to the given email address a list of the unclaimed gaming news\n' +
				'!mailmetech [email]: sends to the given email address a list of the unclaimed technology news\n' +
				'!mailmeall [email]: Mail both gaming and tech unclaimed stories to the given email address\n' +
				'!digest: I\'ll show you the current digest\n' +
				'*Adding Items to be Written*\n' +
				'!addgaming [text]: adds [text] to the unclaimed gaming news database.\n' +
				'!addtech [text]: adds [text] to the unclaimed technology news database.\n' +
				'!addstory [text]: adds [text] to the article database.\n' +
				'!addarticle [text]: adds [text] to the article database.\n' +
				'!addgamepage [text]: adds [text] to the gamepages database.\n' +
				'!addguide [text]: adds [text] to the guide database.\n' +
				'!addscoop [text]: adds [text] to the unclaimed scoop database.\n' +
				'*Claiming a Story*\n' +
				'!claimgaming [text]: sends to your slack inbox all the unclaimed gaming news that start with [text] and removes them from database\n' +
				'!claimtech [text]: sends to your slack inbox all the unclaimed technology news that start with [text] and removes them from database\n' +
				'!claimpriority [text]: sends to your slack inbox all the unclaimed priority news that start with [text] and removes them from database\n' +
				'!claimscoop [text]: sends to your slack inbox all the unclaimed scoop news that start with [text] and removes them from database\n' +
				'!claimarticle [text]: sends to your slack inbox all the TODO stories that start with [text] and removes them from database\n' +
				'!claimstory [text]: sends to your slack inbox all the TODO stories that start with [text] and removes them from database\n' +
				'!claimgamepage [text]: sends to your slack inbox all the TODO gamepages that start with [text] and removes them from database\n' +
				'*EDITOR ONLY Commands*\n' +
				'!addpriority [text]: adds [text] to the unclaimed priority database.\n' +
				'!deleteguide [text]: sends to your slack inbox all the guides that start with [text] and removes them from database DO NOT DO WITHOUT EDITOR APPROVAL\n' +
				'!cleargaming: sends to your slack inbox all the unclaimed gaming news and removes them from the database\n' +
				'!cleartech: sends to your slack inbox all the unclaimed technology news and removes them from the database\n' +
				'!clearall: sends to your slack inbox all the unclaimed gaming and tech news and removes them from the database\n' +
				'!setdigest: sets the new digest (replaces the old one)\n' +
				'!deleteguide [text]: sends to your slack inbox all the guides that start with [text] and removes them from database DO NOT DO WITHOUT EDITOR APPROVAL\n';

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
				'*basic commands*\n' +
				'@clevergirl hello/hi: hello to you :)' +
				'@clevergirl call me [nickname]/my name is [nickname]: I will remember your nickname\n' +
				'@clevergirl what is my name/who am i: I will tell you your nickname\n' +
				'@clevergirl uptime/identify yourself/who are you/what is your name: I will tell you about me\n' +
				'@clevergirl help: show list of commands\n' +
				'*Viewing Items to be Written - sent to you via PM’s*\n' +
				'!viewgaming: sends all the unclaimed gaming news including priority and scoops. Does NOT remove them from the database\n' +
				'!viewtech: sends all the unclaimed technology news including priority and scoop. Does NOT remove them from the database\n' +
				'!viewarticles: sends all the stories and articles to be written. Does NOT remove them from the database\n' +
				'!viewguides: sends the list of guides to be written. Does NOT remove them from the database\n' +
				'!viewgamepages: sends the list of Game Pages that need to be created. Does NOT remove them from the database\n' +
				'!mailmegaming [email]: sends to the given email address a list of the unclaimed gaming news\n' +
				'!mailmetech [email]: sends to the given email address a list of the unclaimed technology news\n' +
				'!mailmeall [email]: Mail both gaming and tech unclaimed stories to the given email address\n' +
				'!digest: I\'ll show you the current digest\n' +
				'*Adding Items to be Written*\n' +
				'!addgaming [text]: adds [text] to the unclaimed gaming news database.\n' +
				'!addtech [text]: adds [text] to the unclaimed technology news database.\n' +
				'!addstory [text]: adds [text] to the article database.\n' +
				'!addarticle [text]: adds [text] to the article database.\n' +
				'!addgamepage [text]: adds [text] to the gamepages database.\n' +
				'!addguide [text]: adds [text] to the guide database.\n' +
				'!addscoop [text]: adds [text] to the unclaimed scoop database.\n' +
				'*Claiming a Story*\n' +
				'!claimgaming [text]: sends to your slack inbox all the unclaimed gaming news that start with [text] and removes them from database\n' +
				'!claimtech [text]: sends to your slack inbox all the unclaimed technology news that start with [text] and removes them from database\n' +
				'!claimpriority [text]: sends to your slack inbox all the unclaimed priority news that start with [text] and removes them from database\n' +
				'!claimscoop [text]: sends to your slack inbox all the unclaimed scoop news that start with [text] and removes them from database\n' +
				'!claimarticle [text]: sends to your slack inbox all the TODO stories that start with [text] and removes them from database\n' +
				'!claimstory [text]: sends to your slack inbox all the TODO stories that start with [text] and removes them from database\n' +
				'!claimgamepage [text]: sends to your slack inbox all the TODO gamepages that start with [text] and removes them from database\n' +
				'*EDITOR ONLY Commands*\n' +
				'!addpriority [text]: adds [text] to the unclaimed priority database.\n' +
				'!deleteguide [text]: sends to your slack inbox all the guides that start with [text] and removes them from database DO NOT DO WITHOUT EDITOR APPROVAL\n' +
				'!cleargaming: sends to your slack inbox all the unclaimed gaming news and removes them from the database\n' +
				'!cleartech: sends to your slack inbox all the unclaimed technology news and removes them from the database\n' +
				'!clearall: sends to your slack inbox all the unclaimed gaming and tech news and removes them from the database\n' +
				'!setdigest: sets the new digest (replaces the old one)\n' +
				'!deleteguide [text]: sends to your slack inbox all the guides that start with [text] and removes them from database DO NOT DO WITHOUT EDITOR APPROVAL\n';


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
