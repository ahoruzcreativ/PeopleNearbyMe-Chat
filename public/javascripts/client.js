/* client.js subfile 1 */

var CONFIG = {alias: "#",   // set in onConnect,
              id: null,    // set in onConnect,
              last_message_time: 1,
              focus: true, //event listeners bound in onConnect,
              unread: 0 //updated in the message-processing loop
             };

var aliases = [];

/* Returns a description of this past date in relative terms.
 * Takes an optional parameter (default: 0) setting the threshold in ms which
 * is considered "Just now".
 *
 * Examples, where new Date().toString() == "Mon Nov 23 2009 17:36:51 GMT-0500 (EST)":
 *
 * new Date().toRelativeTime()
 * --> 'Just now'
 *
 * new Date("Nov 21, 2009").toRelativeTime()
 * --> '2 days ago'
 *
 * // One second ago
 * new Date("Nov 23 2009 17:36:50 GMT-0500 (EST)").toRelativeTime()
 * --> '1 second ago'
 *
 * // One second ago, now setting a now_threshold to 5 seconds
 * new Date("Nov 23 2009 17:36:50 GMT-0500 (EST)").toRelativeTime(5000)
 * --> 'Just now'
 *
 */
Date.prototype.toRelativeTime = function(now_threshold) {
  var delta = new Date() - this;

  now_threshold = parseInt(now_threshold, 10);

  if (isNaN(now_threshold)) {
    now_threshold = 0;
  }

  if (delta <= now_threshold) {
    return 'Just now';
  }

  var units = null;
  var conversions = {
    millisecond: 1, // ms    -> ms
    second: 1000,   // ms    -> sec
    minute: 60,     // sec   -> min
    hour:   60,     // min   -> hour
    day:    24,     // hour  -> day
    month:  30,     // day   -> month (roughly)
    year:   12      // month -> year
  };

  for (var key in conversions) {
    if (delta < conversions[key]) {
      break;
    } else {
      units = key; // keeps track of the selected key over the iteration
      delta = delta / conversions[key];
    }
  }

  // pluralize a unit when the difference is greater than 1.
  delta = Math.floor(delta);
  if (delta !== 1) { units += "s"; }
  return [delta, units].join(" ");
};

/*
 * Wraps up a common pattern used with this plugin whereby you take a String
 * representation of a Date, and want back a date object.
 */
Date.fromString = function(str) {
  return new Date(Date.parse(str));
};

util = {
  urlRE: /https?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g,

  //html sanitizer
  toStaticHTML: function(inputHtml) {
    inputHtml = inputHtml.toString();
    return inputHtml.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
  },

  //pads n with zeros on the left,
  //digits is minimum length of output
  //zeroPad(3, 5); returns "005"
  //zeroPad(2, 500); returns "500"
  zeroPad: function (digits, n) {
    n = n.toString();
    while (n.length < digits)
      n = '0' + n;
    return n;
  },

  //it is almost 8 o'clock PM here
  //timeString(new Date); returns "19:49"
  timeString: function (date) {
    var minutes = date.getMinutes().toString();
    var hours = date.getHours().toString();
    return this.zeroPad(2, hours) + ":" + this.zeroPad(2, minutes);
  },

  //does the argument only contain whitespace?
  isBlank: function(text) {
    var blank = /^\s*$/;
    return (text.match(blank) !== null);
  }
};

//used to keep the most recent messages visible
function scrollDown () {
  var doAutoscroll = (($("#log").scrollTop()+ $("#log").innerHeight() + 40)>=($("#log")[0].scrollHeight));
  //  addMessage2("sys", ($("#log").scrollTop() +  $("#log").innerHeight()).toString() + " " + ($("#log")[0].scrollHeight).toString() + " " + doAutoscroll );
  if (doAutoscroll) $("#log").scrollTop($("#log")[0].scrollHeight);
}/* client.js subfile 2 */

//updates the users link to reflect the number of active users
function updateUsersLink ( ) {
  var t = aliases.length.toString() + " user";
  if (aliases.length != 1) t += "s";
  $("#usersLink").text(t);
}

//inserts an event into the stream for display
//the event may be a msg, join or part type
//from is the user, text is the body and time is the timestamp, defaulting to now
//_class is a css class to apply to the message, usefull for system events
function addMessage (from, text, time, _class) {
  if (text === null)
    return;

  if (time === null) {
    // if the time is null or undefined, use the current time.
    time = new Date();
  } else if ((time instanceof Date) === false) {
    // if it's a timestamp, interpret it
    time = new Date(time);
  }

  //every message you see is actually a table with 3 cols:
  //  the time,
  //  the person who caused the event,
  //  and the content
  var messageElement = $(document.createElement("div"));

  messageElement.addClass("message");
  if (_class)
    messageElement.addClass(_class);

  // sanitize
  text = util.toStaticHTML(text);

  // If the current user said this, add a special css class
  var alias_re = new RegExp(CONFIG.alias);
  if (alias_re.exec(text))
    messageElement.addClass("personal");

  // replace URLs with links
  text = text.replace(util.urlRE, '<a target="_blank" href="$&">$&</a>');

  var content = '<div>';
  content+= '  <span class="date">' + util.timeString(time) + '</span>';
  content+= '  <span class="alias">' + util.toStaticHTML(from) + '</span>';
  content+= '  <span class="msg-text">' + text  + '</td>';
  content+= '</div>';
              
  messageElement.html(content);
  $("#log").append(messageElement);
  scrollDown();
}

//we want to show a count of unread messages when the window does not have focus
function updateTitle(){
  if (CONFIG.unread) {
    document.title = "(" + CONFIG.unread.toString() + ") node chat";
  } else {
    document.title = "node chat";
  }
}/* client.js subfile 3 */

// Handles when a user joins the chatroom
function userJoin(alias, timestamp) {
  addMessage(alias, "joined", timestamp, "join");
  for (var i = 0; i < aliases.length; i++)
    if (aliases[i] == alias) return;
  aliases.push(alias);
  updateUsersLink();
}

// Handles when a user leaves the chatroom
function userPart(alias, timestamp) {
  addMessage(alias, "left", timestamp, "part");
  for (var i = 0; i < aliases.length; i++) {
    if (aliases[i] == alias) {
      aliases.splice(i,1);
      break;
    }
  }
  updateUsersLink();
}

var first_poll = true;

function onMessage(data) {
      var message = data
      if (message.timestamp > CONFIG.last_message_time)
        CONFIG.last_message_time = message.timestamp;

      switch (message.type) { // later on we can break these up into different callbacks and message types.
        case "msg":
          if (!CONFIG.focus) {
            CONFIG.unread++;
          }
          addMessage(message.alias, message.text, message.timestamp);
          break;

        case "join":
          userJoin(message.alias, message.timestamp);
          break;

        case "part":
          userPart(message.alias, message.timestamp);
          break;
      }
    updateTitle();

    // should we include this data in chatroom join callback?
    if (first_poll) {
      first_poll = false;
      who();
    }
}

function onError(data) {
  alert(data.error);
  showConnect();
}

//submit a new message to the server
function send(msg) {
  socket.emit("send", {id: CONFIG.id, text: msg});
  console.log("message: "+msg);
}

//Transition the page to the state that prompts the user for a alias
function showConnect () {
  $("#connect").css('display','block');
  $("#loading").css('display','none');
  $("#toolbar").css('display','none');
  $("#log").css('display','none');
  $("#aliasInput").focus();
}

//transition the page to the loading screen
function showLoad () {
  $("#connect").css('display','none');
  $("#loading").css('display','block');
  $("#toolbar").css('display','none');
}

//transition the page to the main chat view, putting the cursor in the textfield
function showChat (alias) {
  $("#toolbar").css('display','block');
  $("#log").css('display','block');
  $("#entry").focus();

  $("#connect").css('display','none');
  $("#loading").css('display','none');

  scrollDown();
}

//handle the server's response to our alias and join request
function onJoin (session) {
  if (session.error) {
    alert("error connecting: " + session.error);
    showConnect();
    return;
  }

  CONFIG.alias = session.alias;
  CONFIG.id = session.id;

  //update the UI to show the chat
  showChat(CONFIG.alias);

  //listen for browser events so we know to update the document title
  $(window).bind("blur", function() {
    CONFIG.focus = false;
    updateTitle();
  });

  $(window).bind("focus", function() {
    CONFIG.focus = true;
    CONFIG.unread = 0;
    updateTitle();
  });
}

//add a list of present chat members to the stream
function outputUsers () {
  var alias_string = aliases.length > 0 ? aliases.join(", ") : "(none)";
  addMessage("users:", alias_string, new Date(), "notice");
  return false;
} 

//get a list of the users presently in the room, and add it to the stream
function who () {
  socket.emit("who", {});
}

function whoCallback (data) {
    if (data.status != "success") return;
    aliases = data.aliases;
    outputUsers();
}/* client.js subfile 4 */
var socket = io.connect(); // DEVELOPMENT
//var socket = io.connect("http://www.peoplenearby.me"); // PRODUCTION
socket.on("recv", onMessage);
socket.on("join", onJoin);
socket.on("who", whoCallback);
socket.on("error", onError);
$(document).ready(function() {

  /* Event binding */

  $("#entry").keypress(function (e) {
    if (e.keyCode != 13 /* Return */) return;
    var msg = $("#entry").attr("value").replace("\n", "");
    if (!util.isBlank(msg)) send(msg);
    $("#entry").attr("value", ""); // clear the entry field.
  });

  //try joining the chat when the user clicks the connect button
  $("#aliasForm").submit(function (i) {
    i.preventDefault();
    showLoad();
    var alias = $("#aliasInput").attr("value");

    if (alias.length > 50) {
      alert("alias too long. 50 character max.");
      showConnect();
      return false;
    }

    //more validations
    if (/[^\w_\-^!]/.exec(alias)) {
      alert("Bad character in alias. Can only have letters, numbers, and '_', '-', '^', '!'");
      showConnect();
      return false;
    }

    //make the actual join request to the server
    socket.emit("join", { alias: alias });
    return true;
  });

  showConnect(); // possibly move to socket join response callback.
});

//if we can, notify the server that we're going away.
$(window).unload(function () {
  socket.emit("part", {id: CONFIG.id});
});