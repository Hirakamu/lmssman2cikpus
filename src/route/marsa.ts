import express from 'express';

// No relation for the app functionality, just used for appreciation and fun for marsa.

const router = express.Router();
router.get("/", (req, res) => {
    return res.type("html").send(
        `<!doctype html>
  <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Marsa API</title>
    </head>
    <body>
      <h1>Hira Loves You!</h1>
      <h2>Welcome to the Marsa API where all my love goes!</h2>
      <p>Feel free to explore and enjoy the love!</p>
      <ul>
        <li><a href="/quote">Love Quote of the Day</a></li>
      </ul>
    </body>
  </html>`
    );
});
router.get("/quote", (req, res) => {
    const quotes = [
        "Love is not about how many days, months, or years you have been together. Love is about how much you love each other every single day.",
        "In case you ever foolishly forget: I am never not thinking of you.",
        "You are my sun, my moon, and all my stars.",
        "I love you more than yesterday, but not as much as tomorrow.",
        "You are the source of my joy, the center of my world, and the whole of my heart.",
        "Every moment with you is a moment well spent.",
        "You make my heart skip a beat every single day.",
        "My heart chose you before my mind could understand why.",
        "You are my greatest adventure and my safest place.",
        "With you, I found my home, my love, and my forever.",
        "You are the best thing that ever happened to me.",
        "I fall for you more and more every single day.",
        "Your love is the greatest gift I could ever ask for.",
        "You are my dream come true and my reality made perfect.",
        "Forever is not long enough to love someone like you.", "I'm selfish, impatient and a little insecure. I make mistakes, I am out of control and at times hard to handle. But if you can't handle me at my worst, then you sure as hell don't deserve me at my best.",
        "You've gotta dance like there's nobody watching,Love like you'll never be hurt,Sing like there's nobody listening,And live like it's heaven on earth.",
        "You know you're in love when you can't fall asleep because reality is finally better than your dreams.",
        'Darkness cannot drive out darkness: only light can do that. Hate cannot drive out hate: only love can do that.',
        'We accept the love we think we deserve.',
        'It is better to be hated for what you are than to be loved for what you are not.',
        'Only once in your life, I truly believe, you find someone who can completely turn your world around. You tell them things that you’ve never shared with another soul and they absorb everything you say and actually want to hear more. You share hopes for the future, dreams that will never come true, goals that were never achieved and the many disappointments life has thrown at you. When something wonderful happens, you can’t wait to tell them about it, knowing they will share in your excitement. They are not embarrassed to cry with you when you are hurting or laugh with you when you make a fool of yourself. Never do they hurt your feelings or make you feel like you are not good enough, but rather they build you up and show you the things about yourself that make you special and even beautiful. There is never any pressure, jealousy or competition but only a quiet calmness when they are around. You can be yourself and not worry about what they will think of you because they love you for who you are. The things that seem insignificant to most people such as a note, song or walk become invaluable treasures kept safe in your heart to cherish forever. Memories of your childhood come back and are so clear and vivid it’s like being young again. Colours seem brighter and more brilliant. Laughter seems part of daily life where before it was infrequent or didn’t exist at all. A phone call or two during the day helps to get you through a long day’s work and always brings a smile to your face. In their presence, there’s no need for continuous conversation, but you find you’re quite content in just having them nearby. Things that never interested you before become fascinating because you know they are important to this person who is so special to you. You think of this person on every occasion and in everything you do. Simple things bring them to mind like a pale blue sky, gentle wind or even a storm cloud on the horizon. You open your heart knowing that there’s a chance it may be broken one day and in opening your heart, you experience a love and joy that you never dreamed possible. You find that being vulnerable is the only way to allow your heart to feel true pleasure that’s so real it scares you. You find strength in knowing you have a true friend and possibly a soul mate who will remain loyal to the end. Life seems completely different, exciting and worthwhile. Your only hope and security is in knowing that they are a part of your life.',
        'As he read, I fell in love the way you fall asleep: slowly, and then all at once.',
        'It is not a lack of love, but a lack of friendship that makes unhappy marriages.',
        "The opposite of love is not hate, it's indifference. The opposite of art is not ugliness, it's indifference. The opposite of faith is not heresy, it's indifference. And the opposite of life is not death, it's indifference.",
        'I love you without knowing how, or when, or from where. I love you simply, without problems or pride: I love you in this way because I do not know any other way of loving but this, in which there is no I or you, so intimate that your hand upon my chest is my hand, so intimate that when I fall asleep your eyes close.',
        "Love all, trust a few,Do wrong to none: be able for thine enemyRather in power than use; and keep thy friendUnder thy own life's key: be check'd for silence,But never tax'd for speech.",
        "Have you ever been in love? Horrible isn't it? It makes you so vulnerable. It opens your chest and it opens up your heart and it means that someone can get inside you and mess you up.",
        'Being deeply loved by someone gives you strength, while loving someone deeply gives you courage.',
        "This life is what you make it. No matter what, you're going to mess up sometimes, it's a universal truth. But the good part is you get to decide how you're going to mess it up. Girls will be your friends - they'll act like it anyway. But just remember, some come, some go. The ones that stay with you through everything - they're your true best friends. Don't let go of them. Also remember, sisters make the best friends in the world. As for lovers, well, they'll come and go too. And baby, I hate to say it, most of them - actually pretty much all of them are going to break your heart, but you can't give up because if you give up, you'll never find your soulmate. You'll never find that half who makes you whole and that goes for everything. Just because you fail once, doesn't mean you're gonna fail at everything. Keep trying, hold on, and always, always, always believe in yourself, because if you don't, then who will, sweetie? So keep your head high, keep your chin up, and most importantly, keep smiling, because life's a beautiful thing and there's so much to smile about.",
        'There is never a time or place for true love. It happens accidentally, in a heartbeat, in a single flashing, throbbing moment.',
        'Love is that condition in which the happiness of another person is essential to your own.',
        'You love me. Real or not real?I tell him, Real.',
        "You may not be her first, her last, or her only. She loved before she may love again. But if she loves you now, what else matters? She's not perfect—you aren't either, and the two of you may never be perfect together but if she can make you laugh, cause you to think twice, and admit to being human and making mistakes, hold onto her and give her the most you can. She may not be thinking about you every second of the day, but she will give you a part of her that she knows you can break—her heart. So don't hurt her, don't change her, don't analyze and don't expect more than she can give. Smile when she makes you happy, let her know when she makes you mad, and miss her when she's not there.",
        "I'm in love with you, he said quietly.Augustus, I said.I am, he said. He was staring at me, and I could see the corners of his eyes crinkling. I'm in love with you, and I'm not in the business of denying myself the simple pleasure of saying true things. I'm in love with you, and I know that love is just a shout into the void, and that oblivion is inevitable, and that we're all doomed and that there will come a day when all our labor has been returned to dust, and I know the sun will swallow the only earth we'll ever have, and I am in love with you.",
        "I am nothing special, of this I am sure. I am a common man with common thoughts and I've led a common life. There are no monuments dedicated to me and my name will soon be forgotten, but I've loved another with all my heart and soul, and to me, this has always been enough..",
        "Love looks not with the eyes, but with the mind; And therefore is wing'd Cupid painted blind. Nor hath love's mind of any judgment taste; Wings and no eyes figure unheedy haste: And therefore is love said to be a child, Because in choice he is so oft beguil'd.",
        'There is nothing I would not do for those who are really my friends. I have no notion of loving people by halves, it is not my nature.',
        "Love is like the wind, you can't see it but you can feel it.",
        "You don't love someone because they're perfect, you love them in spite of the fact that they're not.",
        "People think a soul mate is your perfect fit, and that's what everyone wants. But a true soul mate is a mirror, the person who shows you everything that is holding you back, the person who brings you to your own attention so you can change your life. A true soul mate is probably the most important person you'll ever meet, because they tear down your walls and smack you awake. But to live with a soul mate forever? Nah. Too painful. Soul mates, they come into your life just to reveal another layer of yourself to you, and then leave. A soul mates purpose is to shake you up, tear apart your ego a little bit, show you your obstacles and addictions, break your heart open so new light can get in, make you so desperate and out of control that you have to transform your life, then introduce you to your spiritual master...",
        "Love never dies a natural death. It dies because we don't know how to replenish its source. It dies of blindness and errors and betrayals. It dies of illness and wounds; it dies of weariness, of witherings, of tarnishings.",
        'If I had a flower for every time I thought of you...I could walk through my garden forever.',
        'If you can make a woman laugh, you can make her do anything.',
        'We`re all a little weird. And life is a little weird. And when we find someone whose weirdness is compatible with ours, we join up with them and fall into mutually satisfying weirdness—and call it love—true love.'
    ];
    const number = Math.floor(Math.random() * quotes.length);
    const randomQuote = quotes[number];

    res.type("html").send(
        `<!doctype html>
  <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Love Quote</title>
    </head>
    <body>
      <h1>Love Quote of the Day</h1>
      <p>${randomQuote}</p>
      <p>Integer: ${number}</p>
    </body>
  </html>`
    );
});


export const marsaRoute = router;