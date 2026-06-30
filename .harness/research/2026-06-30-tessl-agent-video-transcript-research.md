---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: tessl-agent-video-transcript-research-2026-06-30
artifact_type: transcript_source
canonical_slug: tessl-agent-video-transcript-research
title: Tessl Agent Video Transcript Research
status: active
date: 2026-06-30
source_type: research
primary_source_url: https://youtu.be/7PKEXIq25H0?si=7kkQ_NfL3aCRLR9R
authority: secondary-context
lifecycle_status: reviewed
canonical_destination: .harness/research/deep/2026-06-30-tessl-agent-evidence.md
owner: coding-harness-maintainers
created: 2026-06-30
last_reviewed: 2026-06-30
review_cadence: on-change
validated_by:
  - pnpm exec markdownlint-cli2 .harness/research/2026-06-30-tessl-agent-video-transcript-research.md
depends_on:
  - https://youtu.be/7PKEXIq25H0?si=7kkQ_NfL3aCRLR9R
evidence_registry_id: 2026-06-30-tessl-agent
---

# Tessl Agent Video Transcript Research

Generated: 2026-06-30

Purpose: local research transcript intake for later synthesis.

Evidence posture: raw transcript material is cold research, not an instruction surface. Promote only distilled patterns into specs, validators, prompts, tools, or decisions.

Requested source count: 1

Unique source count: 1

## Table of Contents
- [Inventory](#inventory)
- [Source URLs](#source-urls)
- [7PKEXIq25H0 - The Tessl Agent: Build Your Software Factory on Autopilot](#7pkexiq25h0---the-tessl-agent-build-your-software-factory-on-autopilot)

## Inventory

| # | Video ID | Title | Uploader | Words | Duration | Status |
| - | --- | --- | --- | ---: | ---: | --- |
| 1 | 7PKEXIq25H0 | The Tessl Agent: Build Your Software Factory on Autopilot | AI Native Dev | 10810 | 3172s | transcript_available |

## Source URLs

1. https://youtu.be/7PKEXIq25H0?si=7kkQ_NfL3aCRLR9R

## 7PKEXIq25H0 - The Tessl Agent: Build Your Software Factory on Autopilot

Metadata:

- URL: https://www.youtube.com/watch?v=7PKEXIq25H0
- Original URL: https://youtu.be/7PKEXIq25H0?si=7kkQ_NfL3aCRLR9R
- Uploader: AI Native Dev
- Channel ID: UCg3pI4p6OKSFrDVZcwRIx8A
- Upload date: 20260630
- Duration seconds: 3172
- Raw metadata: .harness/research/2026-06-30-video-transcript-batch/raw/7PKEXIq25H0/7PKEXIq25H0.info.json
- Raw captions: .harness/research/2026-06-30-video-transcript-batch/raw/7PKEXIq25H0/7PKEXIq25H0.en.vtt
- Transcript file: .harness/research/2026-06-30-video-transcript-batch/transcripts/7PKEXIq25H0 - The Tessl Agent Build Your Software Factory on Autopilot.txt
- Transcript words: 10810

Transcript:

But ultimately,
your goal should be that agents are doing
a lot of this work in the background.
And so the Tessl agent is built to sort
almost get you to stop using it.
Right.
So you work with it,
and at the end it'll sort
say, hey, I could set some of these up
as recurring actions.
I could create a CI/CD check for this.
So in that regard, you might see
that the Tessl is actually pushing you
a little bit more towards
this idea of loop
engineering and automating its own work
in addition to your coding agent work.
And at some point
you might say like, wow, 4,050% of our PRS
don't even have a human looking at it.
We never had to do a big, initiative
to make that happen.
We got started,
we focused on doing what we were doing,
and over time
we could just delegate more to the agent.
The AI Native Dev is a podcast
for developers and engineering
leads at the cutting edge of AI
and agentic coding.
Join your hosts, Guy Podjarny
and me, Simon Maple,
every week as we chat
with the most exciting voices in
AI and tackle the biggest questions
facing developers today.
This is the AI Native Dev.
We just wrapped up two
amazing days at AINDCon in London.
But the great thing is that
we get to do it all over again
in New York City this November.
You're absolutely right.
We're going to be back in the City
that never sleeps on November 3rd and
fourth for more amazing sessions, really
engaging hands on workshops and much more.
Yeah, all that great networking, partying,
eating and
drinking that you've come to expect
from AINDCon.
We think we have one of the best
hallway tracks from the business,
and it's the perfect complement
to our incredible speakers and presenters.
We'll both be in person and virtual,
with live streamed access
to all mainstage keynotes and talks.
Sign up right now for our Super
Blind Bird ticket for just $100.
Only available for a limited time.
We're really excited to be headed
back to the Big Apple, and we hope
to see you all there.
Hello everyone.
Welcome back to the AI Native Dev.
Today I am excited to announce that we're
launching a new product
from Tessl, the Tessl agent.
We're going to
spend a good portion of this podcast
talking about what this agent is
and what it is.
But don't worry, we're not just going to
sort of talk about our products over here.
We'll also talk about loop engineering
and what that is, and why we think
it's a thing that you should know
about as well.
We'll talk about
the importance of ease of use
and UX in DevTools, even in the AI era,
and maybe some learnings
from a company perspective
about building a product in this era.
So to do all of that, we have Dru
our head of product here from Tessl.
Thanks for joining us, Dru.
Glad to be here.
Finally. My my on to the podcast.
It's been only a year and a half but.
Well you know, don't take it personally.
Well yeah.
See how long it is
till the next time. We'll see.
Yeah. We're we're inspecting.
Yeah yeah, yeah.
So Dru, tell us a little bit
about what this Tessl agent is
and what is it that we've just launched.
Yeah. So there's sort of two pieces to it.
First is that the Tessl agent is
a new interface to all of Tessl's tools.
So everything Tessl does today helping you
scale skills,
make them sort of work organization wide.
Tessl agents is going to help
you set that up, put it together
in more flexible, intelligent workflows,
sort of connecting the tools.
The second, the Tessl agent
is sort of a first step towards a broader
vision of loop
engineering or factory building.
So the idea is that the Tessl
agent is a factory building agent.
So it helps
you go from scaling skills across your org
to building your software factory.
Piece by piece,
setting up these loops
that we'll talk about
how you engineer them
to make agents more effective over time.
Very cool.
And this is I guess you'd still run it
with sort of the Tessl
agent command in the terminal.
It sort of has a little bit of a kind of,
you know, Claude Code,
you know, sort of similar feel for it.
But you know what?
You can ask it to write code
we don't recommend.
Yeah. Yeah you do.
Right.
Like it is focused on sort of I guess.
Pinning agents down
these days is always so hard
because at the end of the day,
you know, you can ask the Tessl agent
to write a poem for you, and it will,
but I wouldn't recommend it.
It's certainly not built for that.
But part of.
Our no, it's not part of our evals.
So ultimately, though, yeah, using
the Tessl agent will feel quite familiar.
It's terminal based.
CLI agent you work with just feels like
Claude Code in that sense, right?
Like, you just type some commands.
It'll pick the right skills and actions
to take on top of that.
But in addition to that,
we've also designed the Tessl agent
to be very automation friendly.
So as we'll get into the idea
of loop engineering,
with much of the work
that you put into making agents successful
and building up a software factory,
you kind of want to get out of these
interactive sessions.
Those are sort of a transitionary period
where you are figuring out what works,
figuring out
where you can delegate tasks and sort of
what are the workflows you want.
But ultimately,
your goal should be that agents are doing
a lot of this work in the background.
And so the Tessl agent is built to sort of
almost get you to stop using it.
Right.
So you work with it,
and at the end it'll sort of say,
hey, I could set some of these up
as recurring actions.
I could create a CI/CD check for this.
So in that regard,
you might see that the Tessl
is actually pushing you a little bit
more towards this idea of loop
engineering and automating its own work
in addition to your coding agent work.
Right? Okay.
So we're going to dig a lot into that.
And we talk about sort of factory
building factory manager.
Let's start though,
just from a concrete use case.
So, you know, I picked up the agent.
What are some examples of things
you can do?
Maybe walk us through a bit of a story
here.
Yeah, I'll give a give a couple
just of how it works.
So probably the one I'm most excited about
that we are using a lot here at at
Tessl is using a Tessl agent
to set up your agent code review harness.
So maybe what I'll do is quickly
walk through how you can use the Tessl
agent to create an agent code review.
Agree with your team on a risk policy
for when humans need to review it,
and then ultimately set up
a recurring loop that will optimize
that code review over time
so that you can just spend
time reviewing code shipping features
and know that everything's
going to get better as you go.
And so there's a few components of this
that I think are pretty
illustrative
of how the Tessl agent works.
So the first you'd come in and just type
something like
set up agentic code review, or
I want to spend less time reviewing code.
And the Tessl agent is going to start
by reviewing
and creating evidence backed findings.
So the Tessl is trained
or instructed
to look through all of your peers,
look through all of your issues
and your issue tracker,
and then also to look through coding
agent session logs that it has access to.
Those can be either local
or if you've been using Tessl for a while
and you've been sort of uploading
those logs, we can look through those.
Yeah, we'll try to.
Find latent knowledge that exists.
Exactly, exactly.
So it's the kinds of information
that you might want to review again.
So it's looking for things
like what is your style guide,
what are common
failure cases that agents might have.
What are comments that your team seems
to provide frequently in code review.
And then once it's gathered
all of this information, first
it will tell you what it's found.
That information
is, as is often the case, what's useful
for agents is also useful for humans.
Yeah.
So writing that down,
it gives you a chance to correct
anything that may be off base there.
And then what it will do is it will walk
you through a few concrete components.
So the first is that it will set up
a general skill based agent,
PR code review and skill
based here is kind of interesting
because it's unlike a lot of tools
that are just sort of one click,
put it in production, you forget about it.
One of the core principles of Tessl agent
and of Tessl will generally, is that
we think people are going to want to own
and build their own factories, right.
That this is the kind of thing
that will be
part of your software
engineering discipline,
not something you buy off the rack
and just take as given.
And so for code review we give,
you will help create a skill that we think
maps to your code review best practices,
but it's a skill that you own.
So you can update it. You can augment it.
You can share it with other people,
put it in other parts of your workflow.
So we'll set that up and
that kind of immediately gets you going.
Now every PR that goes up,
you'll get agentic review.
So once it's created
that skill the next thing that it will do
is set up an actual automated flow
so that when a PR goes up,
an agent with that skill will be run.
So there's a few things that we,
the Tessl agent
and Tessl can help you with there,
which is we
provide basic primitives
for running an agent through CI,
for having it
leave inline comments on a GitHub flow,
just the sort of niceties that every team
ends up building to get a flow
that actually works for them.
But Tessl is built to be modular
by design,
so if there's things you already have
or things you already like,
the Tessl agent is fine working with those
as well as part of setup.
It will try to learn your preferences,
and we have defaults
that we think are great, but it works
with whatever you you want to bring in.
So this already like at this point
you've already used the Tessl to
to figure out what it should have
in a review process to create a unit,
a skill, a plugin to be able to
to execute that code review.
And it is kind of specialized a little bit
in all these like repo automations
or whatever other tools.
So let's say for example, here,
it created a kind of a GitHub action
to run that for you, or it uses our app
and we have a little app to sort of help
point it out.
So you're already you're already just like
with a relatively simple command set up
automated code review right now that is
based on your historical learnings.
Yes. Yeah.
And if you're using the Tessl
default primitives,
you will get a lot of nice things
out of the box.
So one will have helped
you create that code review skill.
We have a cloud sandbox that you can run
the review from,
which will have log observability.
So you can go in and look at the coding
agent logs as it ran.
It's also agent and model agnostic,
so you can switch easily between
any number of coding agents
like Codex, Claude Code, Gemini, etc.
without having to configure all of them.
You just log in to test and then set
which agent you'd like it to use.
Includes open models and open
agents as well, which is great for sort of
minimizing costs, which is a big
one for code review because it's running
all the time, an area
that's really valuable to, to optimize.
So this is the
and the that's probably like a word
that's probably a point
worth emphasizing,
which is the actual review in this setup
isn't happening with T-cell itself
or with central agent.
As we said, that is not a coding agent.
It is running your agent of choice
and sets you up
so you can actually swap
that agent of choice over time.
And we'll talk a little bit
more about how evals can help you guide
to pick the right ones.
Exactly, exactly.
So we help you get it set up.
So a lot of what Tessl agent does
is actually just helping you orchestrate
other coding agents.
So sometimes the Tessl
agent orchestrates itself,
which is always gets a little bit meta.
But once you have that generic code
review set up, the next thing
that the Tessl agent will help you do
is set up a PR review sort of human gate.
Right.
And what this means
is that we found a lot of companies,
when they adopt a code review,
the next question they have is
when do I have to review it now?
Versus when can the agent review it.
And they would like to for simple PRS,
for ones that they have deemed to be
not risky, be able to just let
a good review handle it, and then they can
sort of focus on the more complicated or
riskier PRS would their human review time.
This is a common practice.
Basically, what we found
most teams get to is
you want to agree on some sort of policy
across your organization, with your
security team, with privacy team,
anyone who might who might be involved.
And then you want to set up a
an analysis of every PR to decide
based on this policy.
Does it need a human
or does it not. Right.
And so the Tessl gives you
we call it the change risk verifier.
You can configure it with your own policy,
but it also comes with a relatively
straightforward
one out of the box that you can tune
between either more permissive
if you'd like to do as much as possible
through a code review, or more strict.
So you can say,
I want humans to review most of the press.
So again, help
you set that up as an action
that will just run within your CI
CD pipeline.
And then the last thing that we'll do
is we'll go through
all of your existing skills and context
in your repository, and we will create
what we call verifiers out of those.
So you can think of these as very small,
targeted and fast
LM linting rules that look at a change,
look at the sort of code
that's coming into your code base,
specifically against different aspects
that you've codified in your skills.
So let's say that you have a
design guidelines
that says how accessibility traits
should be handled on new elements.
There will be a verifier
that we can create for
that, that looks at specifically files
that touch front end and looks
just for do they apply
those RA properties correctly?
And if you stack a bunch of those up
and keep them very focused,
you can keep them small, fast, cheap,
and you basically run them like linting
against every every change that comes
in catches a lot of the mistakes
where agents just don't adhere
to what you've codified in your skills.
Yeah, I love that.
So we've now kind of with that command,
set up three different types of reviews.
You review the code itself,
I guess that you sort of invoking coding
agent for
you're reviewing the risk of the change
so you can make some smarter decisions
about whether you merge them or auto merge
or like a little bit of a flag.
Yeah. For people.
So you kind of codify your policy.
And then we introduce this verifiers
there, which probably kind of,
you know,
is worthy of a podcast on its own.
But really what that does is it reviews
whether the agent has adhered to the
context that you've given it,
like the sort of the skills, the attempts
you've already made within the repo
to to define how it should behave.
It checks whether it adheres to those.
The, the verifiers, in my opinion,
are the thing that really closes
the loop between skills and plugins.
And like the sort of instructions
the control plane you have over
agents to the actual code
that is generated.
So it's a way of saying,
I told an agent to do these things,
but did it actually do them in a way
that is fast and scalable
and doesn't require a million tokens?
Every time you want to,
you want to ask that question?
And then the last piece I mentioned,
the Tessl agent will always push
you towards the loop.
We sort of believe in loop engineering.
Yeah, exactly.
Getting loopy.
So the what the final thing that will be
set up is a recurring daily or weekly,
depending on what you'd like.
Automation, where the Tessl agent
will scan again, all of your PR,
CI checks,
PR comments, coding agent sessions
and try to find new mistakes
that are slipping through.
So, for example,
you might start with a more strict human.
Still, most review, most press,
and as humans are leaving review feedback.
The Tessl agent is basically observing
those and creating new verifiers,
or updating your review skill
to try and capture those issues.
And then it'll use the Tessl platform
to create evaluation
scenarios to sort of run back and say,
okay, I've seen this problem.
I've created what I think
is affixed to it.
I've now sort of simulated this
PR a few more times.
Yes. Now, you wouldn't
have had to provide that feedback.
And so that's where you get into
the automated loop of every day.
Every week,
you're just getting a couple PRS
from the Tessl agent that make you
just a little more AI native, right?
Like your skills are a little more robust.
Your PR review is catching
a few more errors over time.
You don't even realize you're necessarily
investing in it this way, but you'll see
sooner code review completion,
less time on code review.
And at some point you might say
like, wow, 4,050% of our PRS
don't even have a human looking at it.
We never had to do a big, big push
or initiative to make that happen.
Just sort of.
We got started,
we focused on doing what we were doing,
and over time
we could just delegate more to the agent.
Yeah.
And I think a core principle
that you're describing here
is that you set it
up to be a loop at a time.
And so we've defined a thing that would
run recurrently the skill of year.
We're running it in some sort of
recurring location in an automation
that runs again and again.
And now we're surveying it
over and over again.
And so
because it's a loop, you can observe
and you can kind of voice an opinion
of saying, okay, has it gotten better?
Has it gotten worse?
And you just figure out what is that sort
of feedback loop that it that it gets.
Yeah, exactly.
It's I'd say the loop is probably
one thing if somebody was, you know,
just waking up to agents today in 2026
and looking to get started,
I think, interestingly, the building
these loops, doing this
sort of loop engineering, it feels maybe
like an advanced topic to start.
But I think in our own experience,
in our own
working with customers
or building our own
sort of software factory, it actually is
feels like the right place to start.
When you get going with these loops,
they solve a major problem
with a generic development.
In fact, this is like one of the main
reasons we chose to build the Tessl agent
is that building your software factory,
making agents more effective,
getting them to run more autonomously,
delegating work to them.
All of that is unplanned work.
You have no way of anticipating
where agents will fail,
when they'll fail, how much work it's
going to take to get them to stop failing.
And so when most teams get started
with the traditional boot up
an agent, you start interacting with it.
They basically find this place
where the agent will have made a mistake
and they have to choose between
do I push through and ship the feature,
or do I pause, roll back,
and do some science to try and make
the agent able to do this in the future?
And so people fall
into 1 or 2 categories.
They either focus on shipping,
in which case
they just get stuck in this local maximum
where they
they never take the time to fix the agents
and get them to a higher level
of autonomy,
or they fall into the second category.
They are disciplined,
they do focus on that autonomy.
But you're left with this gulf of like
several months or longer, depending.
Exactly.
And it's like,
can you eat that sort of a velocity drop
as you basically shift
all your work into internal tooling?
And so moving to a loop early does
two big things.
The first is that these loops run
in very legible ways.
So instead of having a bunch of your
insights into how agents are failing,
locked away
in local coding agent session logs,
if it's running through a PR review.
Exactly, exactly.
It's all it's all available to you.
So you can start
making these improvements.
And then the loop handles the
that grunt work, right.
Actually putting up the PR that says,
I saw this mistake, I think this fixes it
and it allows you to focus just on,
oh yeah, that makes sense.
Except right.
And so it gets the it matches
the sort of investment and the time scale
so that you just stay focused on shipping
agents will get better naturally
as you engage with. Them as. You go.
So I love this sort of loop interaction.
And I guess the
we talked about the sort of the loop
improvement
when it comes to the code review
and inspect those things.
But there's also a loop
around the agent process. Right.
And I, I really like
how in the process of that, you know, we,
you know,
we oftentimes sort of preach here
the importance of evals
and how you do that.
And so one of the challenges
I guess we've been
encountering is that, you know,
like what do developers not like doing?
They don't like writing docs
and writing tests.
And lo and behold,
you know, they kind of need to.
All. You got to do write those on the app.
So I think what I also like
about the concept of, of the loop
is that it moves the
at least the test authoring into something
that is done through observation.
So instead of having the human
write down the developer and review things
which, you know, again,
sometimes you still need to do,
you still need to define those tests
upfront,
but hidden behind the scenes,
if you sort of use the Tessl flow,
you know, we will have created some evals
for that plugin that you have because
we've looked at issues, but as you do
the loop, you know, you can now say,
okay, let's extract an eval out of that,
out of that process of it.
And, you know, again,
you can kind of debate about
how much do you do you let you know, like
how much do you accept those,
you know, autonomously or not.
But you extract test cases
based on real world scenarios.
So you still get yourself into a place
in which you're not only
modifying continuously,
but you're also building more confidence
in your changes
because you're creating evals as you go.
Yeah.
But at the same time, you are
you're not making an effort.
Like you're not really asking developers
to do this thing.
And we can probably
we should towards the end, talk
a little bit about these of use
and sort of its importance.
But it's one of those things
where eventually, yeah, it might be right.
But if it's not easy,
people won't do it. Yeah.
So I like that.
Which I guess
kind of
maybe I'll ask one more question
about the review thing
and then we'll expand
to some other use cases.
But you mentioned cost in passing.
And I guess I guess that comes down
to that sort of eval process over here.
Right?
It's like what happens over time
as I run these things.
What do I need to do to be able to make it
cheaper?
Yeah, yeah, yeah.
Costs certainly a much hotter topic
these days than it was.
It's amazing.
Like a month ago, if you were talking
about costs, you were a Luddite.
You know, you were like,
yeah, you're not believe not
I believe you're not sufficiently AGI
build, you know, on it.
And now you're like a forerunner.
You know, you're thinking about it.
You're like open models on it.
So it's amazing how these things twist.
It is.
It's certainly makes it hard
to build products that are forward
looking and people where they are today.
But, I'd say that there's
maybe two big pieces to this.
So again, to your point,
we get a lot of questions from folks
internally
or externally working with customers on
how do I think about cost,
how do I make these things cheaper,
but without sort of unnecessarily
slowing my devs down?
Right.
Like people are willing to pay
if it has good ROI,
but they also don't
want to just pay because.
So I think the first thing is, is I'm
sure going to become a broken record of
like pulling it back to loop engineering.
But the first piece of advice I always
give and the Tessl agent really tries
to espouse this philosophy, is don't
try to optimize your general cost, right?
If you're thinking about how do I make it
so that every time someone opens
Claude code,
they're picking the right model
they're planning with opus
and then delegating to haiku or things
like that, that's going to be a bit of a
losing game, I think, for for two reasons.
The first is humans.
Nobody really wants to think about that
kind of stuff as they're getting going,
and they'll kind of always default
to whatever their preference is.
But the second is
that it's also very hard to anticipate
upfront
when a job is going to become complicated.
You might hit an unexpected issue, snag
part of the code base
that you thought this was a haiku task,
or you thought this was a, you know,
GPT four one or something like that,
but it actually is A55 task, right?
So that is just hard.
And I'd say for most people,
you're going to get the best results
in your daily interactive
driver of just use the best model
that you're comfortable using
and let it be flexible.
But then alongside that,
if you are good about identifying
recurring tasks
and structuring them into workflows
and really relentlessly
carving them off of that general purpose
path into a dedicated skill or plugin
that codifies.
This is how we add
a new command to our CLI, or
this is how we do version bumping
or anything like that, right?
Those become great targets
for optimization.
And so what I generally say
is the work of delegating and sort
of putting a box around a certain task
and setting it up to run automated
is also the work of cost optimization,
because then you can find
where your bottlenecks are, say
this is a workflow that runs, for example,
code review every single PR,
so it's 50, 60, 70 times a day.
And it's really important to us.
We really need to strike
the right balance of cost versus quality.
That's where you can bring in the rest of
Tessl's tools to say, I have this skill.
It codifies my workflow for code
review, create a bunch of hypothetical
PRS for it to review,
run it through its paces,
try it on a small model,
try it on an open model.
Help me make that trade off.
Maybe it's 5% worse, but 80% cheaper.
I'm willing to pay that cost.
And so the Tessl agent basically
is built to help you do that process.
It watches you as you work with agents.
It watches the PRS you put up, and it's
going to try and sort of bit by bit,
move repetitive
tasks into structured workflows.
And then once that's in place,
it can help you optimize them.
Right? Yeah.
And I think we've always observed
how like we our EVAs
could help, you know, for instance,
that you can use whatever it is deep seek
instead of sonnet or instead of,
you know, GPT five five.
And that's fine.
But one of the struggles was like,
how do I again,
from a kind of reasonable ease of use?
You know, do you really expect people
to every time, you know, spawn a sub agent
with that or change it
and remember what they're doing it?
And so I think one of the sort of the
hidden wiring that we do when you set up
the agent is
when you run that environment,
we don't just set up
the skill in the plugin, but we also run
it under this command called Tessl Launch,
which again, will probably sort of
write more about, which is more of like
an environment management setup,
which allows you to then
modify that sort of a project
or that plugin, and it runs.
So once you've concluded that you can also
switch easily and it's all about
just sort of the gradual path. Right.
And the evolution.
This is I'd say a big.
So in many ways
the Tessl agent is an interface to
and a driver of a lot of these workflows
that without the agent,
we found that just building up towards
a factory was too hard.
There's knowledge that you don't have
that's changing.
Every few weeks.
People would try to build their own
harnesses and then update their harnesses,
and then update them again
and then cobbling everything together.
So a lot of what we're doing to your point
is just trying to bring into one place
a vertical agent, focus
specifically on this task with good tools,
the right sort of latest cutting edge
knowledge kept up to date on your behalf.
But you could probably take
a bunch of this and use it elsewhere
if you want it right.
We like to work with
any agent that you bring,
but we also want to make it easy, easy
for users.
But there's a second component that you
alluded to with one of the new commands.
We're launching, Tessl Launch,
which is basically allowing you
to create an environment
for agents to run in.
When you get into this task of,
okay, I have my sort of skills
platform in place,
I have the governance, the security,
the standardization that I want.
I'm ready to start scaling
and building these loops.
Teams immediately start building the same
few primitives over and over again.
Right?
You need a way to wire your issue tracker
up to some kind of agent environment.
To kick off tasks, you need a whole suite
of agent code review.
You have things like when task finishes,
I want to post back to the issue tracker.
And so alongside the Tessl agent, we're
releasing a whole bunch of building blocks
that make those parts easy.
So the big one that you mentioned, Tessl
launch, is just a sort of dead simple
drop it in coding agent environment
runs in the cloud, gathers
all the logs for you to review and do that
sort of optimization loop against.
But it also just has good defaults.
It can run for longer than 60 minutes.
It doesn't have to refresh its GitHub
action token all the time, right?
Easy to switch between agents.
There's a few others
that I'm sure we'll detail in the
in the launch blog post,
but all these things come together
to your point to make it really easy
to just start building your factory
one piece at a time, right?
You don't have to pause
and do a foundational investment
to build a linear app and a GitHub app
that can talk to each other, and then
think about the polling semantics.
You can just find a task,
put it in automation,
and then find the next task,
find the next task.
And it's never going to feel like
you're stopping to do this big initiative.
You're just slowly working towards
automation.
Yeah. So I love I love that definition.
And I guess also probably as people think
about sort of Tessl as a whole, you know,
we increasingly think about Tessl
as this sort of composable factory.
Right.
And you run the agent
and you can use the Tessl tools.
And clearly,
you know, we're sort of quite familiar
with built the tools for a reason,
you know, so we have those whether those
are the existing tools,
like our ability to eval
and gather logs and and analyze them,
but also
or these sort of newer capabilities
that were that we're introducing.
But the idea of the agent is it can help
pull that together and provide you
these different services to help you,
which I guess kind of gets to
to a common question that
that we kind of get and sort of discuss
with customers around this notion
of building a factory versus buying one.
Right.
I think today it's
sort of a non-controversial statement
to say that everybody needs
to kind of work towards a factory.
Yeah. Be there.
We spoke a lot about how we want to
sort of help you along that journey,
but there's a question about
what is the state that you end up in.
Do you are you are you trying to
sort of build something and kind of,
you know, lure people in
in which they sort of
they have to use,
you know, the componentry
and you're kind of
getting into a walled garden
or is it something that's built?
So maybe you can say a few words
about sort of our philosophy
when it comes to kind of factory
building and kind of,
you know, own it versus by it.
Yeah, of course.
So I'll belie some of my roots here.
I started my career
working on open web platform
web standards, so certainly have a bit
of a bleeding heart for this as well.
But I also think it makes good sound
business sense.
At Tessl,
we think that the factory that you build
is going to be a piece of technology.
It's going to be a differentiator
that your team owns.
It's part of your software discipline,
is building and maintaining this factory,
and that there will be repeating
components to a factory,
but that everyone's factory
will look slightly different
based on your preferences
and the services that you use.
So factory platforms will be much more
like platforms, less like frameworks,
or end to end solutions
that you just buy off the shelf black box.
And we think that for a few reasons.
I think the most important one
is that when you think about
the grand total of building software
products, there's a lot that goes into it.
It just seems hard to imagine
how a single provider,
a single company, could be best
and breed at every single component
that goes into that right
design, mock ups, code
review, actually generating code,
working with your legal team, sales,
all those things need to be brought in
to the factory over time
and buying into a single solution.
Somewhere in that stack
you're going to be buying into
not the best version
of of that component.
And so we think that being open, modular
like Tessl wants to provide good defaults.
So you don't have to think about it
if you don't care about it.
But for the parts that you care about,
you need to be able to plug in
either your own built solution
or the best of breed
so that you can be getting the results
that you need.
Yeah, that's a that's an important one.
I think.
The other is that when you think of
how critical this factory is going to be
to your company, I mean, in effect,
it is the thing that produces your.
Product developing.
Yeah, exactly.
And so it's a very sensitive place
to be bought into a fully integrated
solution that now has complete
pricing leverage over you.
Right.
If you think about just
the sorts of processes
and workflows that you bake in, right,
they're very specific.
And that's part of what becomes your IP,
your moat against competitors.
But imagine if then all of that work
you've built to differentiate yourself
is now owned by someone else.
And so they say, hey,
everything that makes your company
you is in our ecosystem.
And so we're going to crank up the token
cost, the token spend, etc..
And so we think that your factory
needs to be built on an open
modular framework that you can sort of
trust to assess its own work.
Right.
Optimizing the factory is like
an important component of the factory.
And so you need to trust it when it says,
hey, this time you really do
need to use the biggest model,
and you do need to spend
50% more on tokens.
You don't want to be questioning
those kinds of suggestions.
And then finally, it's like a big part of
is we like to think of
there's the rails that your factory runs
on, and then there are
the artifacts and knowledge, the context,
basically, that powers
those rails in the in the factory.
And for that, we believe
that you should own those artifacts
so that you can always pick up
and move to another provider.
You basically own the the secret sauce.
Right?
So a great example of this
with code review, we think that
there is a general harness
that should provide code review.
But you don't want the brain of your code
review to be locked inside that harness.
You want to be able to say, look,
we found a better tool.
We're going to move to it.
All of the work we've put into finally
crafting our workflow, our style guide,
the things that we've worked for,
that's just a skill.
Checked into our repo
so we can go plug that into any brain.
To nail.
And I think so.
So this is very consistent with how we've
generally been thinking about sort of
context and skills and building those out,
which is we we believe in the future
you will have many agents because agents
will specialize in different things.
We think you will need to sort of share
context with them.
And similarly, we think you'll actually
have multiple factories,
you'll have different factory lines
or different
sort of aspects that optimize
for different different parts
and different sort of stages
of, of development.
And really we're talking a lot
about software factories over here,
but we expect very much that this
sort of expands into agentic factories.
Yeah.
And also like maybe it's
worth pointing out that,
you know, while like all of this stuff,
it could sound a little bit
like, like a change from what
we have been discussing all the time.
Right?
Like, we we've been talking about sort of
scaling skills and,
you know, governing them and,
and securing them.
And a lot about context
and context is the new code.
And how do we think about that?
So I guess it's it's worth maybe taking
a moment a little bit to say like this.
We don't perceive this as a as a pivot.
We see it as an expansion, I guess.
How how does all of this conversation
around scaling context,
scaling skills that, you know, again,
customers have a real pain around it.
How does that relate to the agent?
You know, like over here
we're starting saying loop engineering
kind of alluded to harness
engineering on it,
which again probably needs like its own
kind of conversation on the podcast.
How how do you see the two interacting?
Yeah.
On the product team,
there's always have this question of sort
of what is our field to play on or not.
And so we're always asking the question
for new feature, like,
does it make sense
for us to solve this problem.
And this is actually one of the easier
choices or easier decisions
when we think of Tessl's mission
of agent enablement, we want to help you
actually bring coding agents
and all agents in the future
to do real productive work for you.
This just feels like
a very natural extension of that.
So in that regard,
I think it's all part of the same goal,
which is help
you actually deploy and delegate work
to agents effectively
and get real productive work done.
Maybe from a more mechanical perspective,
I think all of these are aspects
of the same solution.
So it really sort of depends
on where you're starting.
So most companies
that have gotten started with agents,
they're starting to feel skill sprawl.
They have hundreds of thousands of skills.
They don't know which ones are good.
They don't know where the duplicates
are. Right.
Those folks want to get started on
the governance end of the spectrum, right?
They're going to say, help me inventory
all of my skills, use Tessl
to do a security review,
find any vulnerabilities,
then create policies to make sure
that we never have this issue again.
They're going to start doing
review quality review on skills
codifying their best practices.
You can think of this as taking charge
of a sort of grounds up, up
swell that you want to now make sure
scales effectively across your company.
And it's worth noting that
that's also the whole world of non
dev skills
is where we've seen a lot of pick
up and adoption, which is we help
a lot of customers deal with with kind of
that world of they have their sales
skills, their marketing
skills, their product skills on it.
Those worlds are generally
not ready for words like factory.
There's sort of a lot more around,
just as one of the sort of share
best practices
basically around that and usage packaged
up in the form of skills and rules.
I think of this as the very sort
of bottoms up form of factory building.
Increasingly, I think of all of this
as factory building.
The question is, do you build the factory
by focusing on the components first,
like finding your workflows,
putting them into skills, getting
your team trained up on how to work
with agents, how to review their work,
or are you a bit
more on the leading edge of things?
You want to start factory first,
and then as you get automated
workflows running, you're going to go in
and decompose the components that matter
that you then want to add in things
like governance or standardization.
Right?
So coming from this other direction,
you might come in immediately with set up
a code review
or agents can't work with our front end
layout, make it better and then make sure
they never get worse at it again.
Right.
And so you're starting with these loops.
And I think it's a great way
to get started.
If you are introducing your team
for the first time to agents, because
this is very focused on making agents
effective and delegating work to them.
A quick path to value. Exactly.
And you're actually setting yourself up
in a good spot. Yeah.
And it helps
you also isolate the change as you work.
Right.
You have one team
just get started with agents
make themselves a bit more effective.
You don't have to worry
about the governance
and the security parts at this point,
because it's just the one team
working on it.
But at some point you're going to want
to start scaling that out, right?
Like you'll have proven it with one team.
They're effective.
They've automated a lot of their work.
They want to start interfacing with
other teams in this automated fashion.
And that's where these governance
and standardization primitives come in.
We say, okay, now I'm going to start
letting everyone in the company
throw skills into this registry.
We see again and again as all of
these things run at the pace of agents.
And so the first week you'll say,
I'm just getting started with skills.
And then the second week you're like,
I have 15,000 skills.
What happened? Right.
So you kind of
have to get these primitives in earlier
than you probably would normally, but
it really just depends on
what are you trying to do first,
are you trying to bring agents
across your organization,
or are you trying to sort of
go deep on some agent close
and get them automated?
Yeah. Cool, cool.
So I think for us, we try to build all of
that in that type of kind of composable
approach to, to kind of helping you build
kind of that factory, that estate.
So it's always in your control,
it's your context, it's your plugins, it's
your kind of workflows.
And now it is sort of your loops
and your your sort of harnesses
that we help you optimize.
And I guess just as a side comment,
we focus very much here
on sort of the agents
advantages in the sort of new competency
from in terms of like Tessl
helping you with loop engineering
and harness engineering.
But, you know, the agent is
also an interface for many other things.
And we you know, we love sort of seeing,
you know,
customers use it for customizing
and defining their policy
for handling that inventory processes,
for sort of building those out.
So excited about the agent.
And it's interesting
how we we kind of grew to
to accept and get used to in the web
interface, having a little agent
chat on the side and say, fine.
Yeah, you have, you know,
all of these things that you can invoke,
but then you can have the agent
to just perform a bunch of actions for me,
whether it's on my sort of slide deck or
in my analytics portal or whatever it is.
Yeah.
But we we still think it's a slightly
kind of bigger deal or a change
when it's on the command line interface.
So in that sense, like
it is also just a command line interface,
and it will eventually make its way
to the, to the, to the web interface as.
Well, starting with the local CLI.
It just kind of gives you
the most flexibility.
And so given Tessl's overall approach
to factory building, it just
it seemed like a no brainer.
We'll start with the thing
that gives people the most power.
And then exactly to your point, coming
very soon, we'll have much
more streamlined interfaces for folks who
aren't comfortable with the command line
or who just want something in a simpler
GUI interface, things like that.
Hey everyone!
Hope you're enjoying the episode so far.
Our team is working really hard behind
the scenes to bring you the best guests,
so we can have the most informative
conversations about agentic development,
whether that's talking about the latest
tools, the most efficient workflows,
or defining best practices.
But for whatever reason, many of you
have yet to subscribe to the channel.
If you're enjoying the podcast
and want us to continue to bring you
the very best content.
Please do us a favor
and hit that subscribe button.
It really does make a difference
and lets us continue to improve
the quality of our guests
and build an even better product for you.
All right, back to the episode.
So we're kind of running
running up on time here.
I want to maybe share
kind of one learning from
from the product building side of this,
which I think is sort of useful
and it's interesting or maybe even two.
One is just sort of reiterating
the importance of ease of use.
Right?
We're we're seeing this like in
I like talking about how,
you know, even like in sneak days, I would
talk about ease of use for security
and how for everything in life,
there's how much you care about something
and how hard it is,
and you need to care more than it is hard.
Yeah.
And then and then you act.
And so it's interesting
to see the action over here.
And I think one of the things we're trying
to address in terms of these abuses is,
is just the ease of use
of getting into this business.
It it has kind of a newer problem,
and it's not a new problem
that you can't keep up,
but it's a much bigger problem,
you know, right now on it.
So the agent kind of embodies
a bunch of that knowledge.
So yes, technically you can run it
with whatever, you know, with your codex,
with your cloud, with your sort of Gemini,
but it's, it's, it's
you need to know what you're doing
and it's a lot of work.
And then whatever it is
you thought you knew, you know,
like,
loop engineering is like a few weeks old,
you know, like best,
you know, in terms of, a term.
And so capture that knowledge it's about
is of use of, of the, of the UX,
of being able
to run a bunch of these things. It's
what is of use with sort of Tessl
providing
a bunch of these tools around it.
So you don't need to say, okay,
you can do this,
but now you need to equip yourself
with these
seven different sort of foundations on it,
which again, over time you might modify,
you might switch, you know, you sort of
push us to sort of build better tools.
And, and I guess
it's about the ease of use feedback loop.
Right.
Because what we've seen
is we created tools.
We gave them to users.
We wanted to make it easy.
So we gave them skills as well.
And they ran.
But as they would run them in their sort
of coding agent of choice.
It was it was hard for us to fix problems
that we've seen.
It's hard to see visibility
like as a product builder,
you want to be able to see what's going on
so that you can improve.
It was hard to fix issues
if the agents went sideways or a new
whatever anthropic model sort of,
you know, suddenly became less obedient,
which we've had many,
many, many cases of that or tuning it.
And so the harness gives us that.
And so I guess as I, as I think about a
in this kind of spills a bit
into my sort of second view,
is that increasingly, I think that the,
the shape of a product in the AI era
is sort of these like four components,
which is a set of tools that you build,
which we used to call in,
like the prior products.
Yeah,
it was kind of the, the capabilities.
But now we think about them as tools,
a set of skills,
the kind of embodied expertise, a harness
to be able to provide a UX and bundle
all of those things.
You know, this is our harness.
We also help you build your harness. Yeah.
And the likes
and then some form of control center
or like central for collaboration,
especially as you go, you know,
across time and across people to do that
which we offer with the platform.
So and it was an interesting
kind of learning.
Yeah. Here. The way that I've sort of
brought
it together
when thinking about designing new products
and maybe like a very concrete way,
is that, like you said,
ease of use has always mattered,
but agents have added a few new layers,
especially if you're thinking about dev
tool products, which is that historically,
I think dev tools have focused
a lot more on providing expressive power,
like make sure
that you have really modular,
composable primitives
to do high value tasks.
And there was just sort of an expectation
that the value is going to be enough,
that as a developer,
you will learn my new vocabulary,
you will stitch them together,
you will do a lot of building on your own.
And I think the first thing
to really internalize about agents is that
they've really made all of us insatiable,
like outcome oriented machines, right?
Gone are the days we say,
oh yeah, to do this, just call this,
call this command,
then this command and this command.
And, you know,
they're all like, you got to learn a bit,
but no, it's worth it.
And now it's like,
I'm going to tell you what I want,
and I expect everything to happen.
Just so that sort of end
and I want to speak in outcomes
I don't want to speak
in the language of your product is
has never been
more extreme in this moment.
I think the
the second is the usability of knowledge
become is like supercharged, right?
Agents are changing so fast,
or changing the industry so fast
that not only is there just a lot to learn
because there's all these new concepts
coming out, but learning is no longer
a one time event.
I mean, we've always had
continual learning,
but now it's continual
learning means like daily or weekly.
And so I think a significant portion
of usability that you can provide
is handling that on behalf of your users,
keeping things up to date for them,
and then maybe an outshoot of
that as you yourself
become more agent
enabled as a product company,
one thing that we have found is quickly,
your rate of shipping features
will start to outstrip
your GTM motions eventually
just your users ability
to ingest the changes.
And so you sort of end up
getting back into this place
where you have to provide
an agent interface that is keeping up
with the change of your product, so
that users can stay focused on the thing
that is stable, which is their business
and what they want to be doing.
And then the agent is constantly updating
and translating that into the latest
and greatest in your product.
Yeah, yeah. It's
just all the way down. Yeah, yeah, yeah.
The answer is always more agents.
Yeah, yeah.
Indeed.
So we said a lot about code
review in the process of it,
can you just sort of quickly
name a few other examples of loops
or use cases
that the agent can help you with?
So there's sort of infinite,
which is always makes it hard
to talk about these products, but I will
I will control myself just a few.
So after setting up code review,
I think my next few favorite
first is you can just ask the agent,
what could I delegate to agents?
And it will go
and look through recurring tasks
that seem to succeed with a high rate
for you, and suggest creating
automated CI/CD actions around that.
Another thing that you can do is
if there is a certain component
or type of feature
that agents have been struggling
with, you can just ask Tessl and,
you know, help agents
work in my front end or make agents
more effective at designing layouts.
And it will go and it will analyze
fine failures, pull them in.
Another great one to get started
is make my repo agent ready.
This will do a bunch of things,
but one of the main things is we have
a bunch of default repo maintenance tasks
like daily architecture review,
test quality checks, things like that
that will just set up for you.
It's a great way to get going of
just immediately hand off
a bunch of work to agents
in a sort of general purpose way.
So I'd say those are
probably the ones that get started.
Just set up code review, fix
a thorny issue where agents have just been
messing up in your code base, set up repo
maintenance tasks, or just ask the Tessl
agent to help you delegate more work to AI
and then it'll go from there.
Yeah, I love those.
I also, I like a recurring things around
all of those activities.
And so like each of those things,
once you get them loopy.
Yeah, you you start saying,
okay, run a kind of recurring architecture
review, you know, fix
my flaky tests on a recurring fashion.
And once you have one set of loops, then
you can make loops around those loops.
So you set up your daily
architecture review, but then eventually
you can set up a loop that monitors
your daily architecture review
and makes it more effective
every single day or week.
And all of this
I know it can seem a bit overwhelming,
just, you know, loops on loops on loops.
Tessl
agent is designed to handle all of this.
So you just give it the task,
give it the problem you're seeing.
And one of the main things
that the Tessl agent does is think about
how to break it down into a loop
and suggest an automation
so that you never have to do
the same task more than once or twice.
And maybe I'll also highlight
that many of these automations
in these loops, they will
oftentimes be focused on the repo itself.
So the other flexible aspect of it is
do you
like oftentimes
you will set up those optimizations
and they will land
as let's say a GitHub action, right.
That runs on a schedule
or things like that.
If you're sort of doing something
that's in the repo, and then of course
you can kind of set up automations
that are that are a bit more broadly.
So lots and lots to do. So much to do.
I've never been more busy.
So, you know, lots of exciting things.
And it's worth in talking about learning
and talking about sort of,
you know, knowledge on it.
Worth noting that we're actually
also launching just now, Tessl Learn,
which has some interesting agent patterns
and has sort of education capabilities.
So hopefully people will check that out.
This episode was dedicated
to the Tessl agent.
But you know, there's sort of a
more more that, you know,
we've been we've been shipping
as the as the pace picks up.
So before we close off Dru, just
a couple of words about what happens next.
Now we launch the agents.
What what happens next.
And then how can people get started.
Yeah. So number one we've just launched.
We're really excited
to get feedback from folks.
Sort of always the name of the game.
As you can expect the Tessl agent
to get faster, cheaper, smarter
at everything we've talked about here.
And then from there,
I think we're really just focused on
how do we make it easier, more seamless
to go from any starting point
you may be at with scaling skills
or exploring a few automations to
how can we get you towards
that factory vision faster
with less effort, less uncertainty,
lack of confidence as you go, but
really focused on that incremental path?
I think that's the main thing to expect
from Tessl is where the
we want to be the tool that helps you go
from where you are today to factory.
We're not just the hey,
if you can throw everything out
and build a greenfield code base,
you can do the cutting edge.
So expect to see more there.
Indeed, this this notion of
you know, we talked about sort of the the,
the catch phrase rate from scaling skills
to to a full on factory.
You know, maybe those loops.
Some were sort of
in the in the process of it.
But it's a it's okay.
Everybody's behind.
Yes. That's sort of gradually.
No one feels comfortable.
Everyone wants to go faster.
But we're here to help you move
sort of through that process
in terms of how to get started. To get.
It's pretty easy.
Just go to the website,
download the Tessl CLI
and then ask it to do something for you.
So tessl, hit enter.
Just like every other agent,
you'll open a session.
Ask it to set up code review.
Ask it to delegate some work to
AI for you.
All of those things will work just fine.
It's an agent, so you can ask it to do
other things as well.
And then over time, more and more of it,
we put into automation
just as you
as you work with the agent. Yeah.
And I think
if you want to do the experiment,
you can also try out having different
team members run the agent because it does
look a little bit at their logs.
And so there's a little bit of an element
of if you heard that someone is having a
problem having them try the Tessl agent,
that might be an interesting experiment.
Yes. Yeah, yeah, it's a great way
the agent both can look
at your local logs.
It can also help
you get your logs into a communal space.
And as a point of getting started,
sometimes just sitting down with the last
month's worth of coding agent sessions
and just asking what's broken,
what's taking a lot of our time will yield
some really interesting results.
So I think that's it for us.
Hopefully you find the Tessl
agent interesting.
We'd love to have you try it out
and and share feedback.
You know,
this is very much about iterating.
Hopefully you're well familiar that we're
all about the community at Tessl.
So join the native dev discord.
Share comments and feedback
that you have around the product.
You know, things you love, things
you want to see us change.
We're super, super
excited about the Tessl agent over here.
Probably the.
Most getting a little bit
told off, a little bit about the,
you know,
just sort of how much we talk about it,
but very, very keen to to see it
come to life early users,
thanks a lot for all the great feedback
and evolutions for it.
And yeah.
Try it out and tell us what you think.
Yeah. Can't wait.
And with that,
thanks for tuning in to this episode
and hope you join us for the next one.
AI Native Dev is brought to you by the package
manager for skills and context.
Your hosts are Guy Podjarny
and me, Simon Maple.
Our producer is Tom Dowler.
The AI Native Dev is not just a podcast,
it's a community.
And we host monthly meetups
at the Tessl offices in central London.
Visit Tessl IO forward slash community
to learn more and I hope to see you there.
