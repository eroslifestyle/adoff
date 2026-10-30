# I Turned Claude Opus 4.7 Into a 24/7 Trader

**Canale:** Nate Herk | AI Automation
**Video:** https://www.youtube.com/watch?v=6MC1XqZSltw
**Durata:** 33:15
**Trascritto con:** Whisper (base) — speech-to-text

---

## Introduzione

So Cloud Opus 4.6 is finally here, and it got me thinking. Because as I was scrolling down and I started looking at the benchmarks, I noticed right here we have a gentick financial analysis, and we have about a 4% jump from Opus 4.6. And about a week ago, I dropped this video where me and Sommen traded stocks for 30 days with our OpenClaw agents, and my OpenClaw agent was set up with Opus 4.6, and I was able to beat the SMP by about 8% as you can see right here. This green line is my chart, and this gray line is the SMP.

So if you guys wanna check out this full video, I will link that right up here. So after this challenge, I wanted to keep my agent running to see if it could keep beating the SMP, but now I wanna upgrade it to 4.7 instead of 4.6.

So that's exactly what I wanna cover with you guys today. **How do we build a 24-7 AI trading agent with Opus 4.6 inside of Cloud Code?** We're not even gonna touch OpenClaw or Hermes agent. We're going to just do this with Cloud Code.

And this is all going to be thanks to another feature that we just got from the Anthropic Team called **Routines**. If you don't know what that is, I'm gonna break it down in this video, but I also made a full one if you wanna check that out.

So basically this is the unlock. **4.7 plus Routines means you can have a 24-7 AI agent** and 4.7 was built for full throttle, agentic work, judgment over ambiguity, and self-verifying outputs. So it's perfect for these types of routines and that's how I'm gonna set up my 24-7 trading agent with Cloud Code routines.

---

## What Are We Building?

We're going to create a Cloud Code project that runs on a schedule, something like a pre-market, cron, a market open, a midday, and a close. It's going to:

- Research the market
- Place trades via the Alpaca API
- Journal and write context into files so it can learn
- Send an end of day summary to ClickUp every day

The goal obviously is just to **beat the S&P**. We're not looking to do any crazy crypto or crazy day trading stuff. I'm just kind of doing this as a fun long-term investment. Just beat the SMP challenge. In my first 30 days, I gave Opus $10,000 and we were able to beat the SMP by about 8%, which is really good.

---

## Tech Stack

- **Cloud Code Routines** — scheduler
- **Opus 4.7** — AI model
- **Custom Skills** — research, decisions, trade execution, logging
- **Alpaca API** — brokerage
- **Perplexity API** — research
- **ClickUp** — notifications

---

## Getting Started with Tools

### Alpaca

Go to Alpaca.market. Sign up and click on Trading API. You'll have a paper trading account. You could also open a new account with real money — you might have to verify your account which could take a couple of days.

On the right-hand side, you have your API keys. You get an endpoint and a key. You also need a secret key. Hit Regenerate, Generate New Keys. Make sure to save both because the secret goes away after you close the dialog.

### ClickUp

Go to settings, scroll down and find ClickUp API. Copy the token.

### Perplexity

Go to All Settings, find API platform, and get your API key.

### Cloud Desktop App

Type in "Cloud Desktop app download" and install it. You need a paid subscription ($20/month or max plans).

---

## Mental Model

The trading strategy is a piece of the work, but the **memory architecture** is going to be huge. Every time a routine fires at 7am, Cloud Code basically wakes up essentially stateless. It doesn't really know anything.

**How do you make a stateless agent act disciplined and remember rules and learn over time?** You do that with files and with context.

Every routine basically:
1. Wakes up
2. Reads files
3. Does the job
4. Writes back any important lessons

### Context Budget

Treat tokens like money. Each routine gets about 200,000 tokens to work with. System instructions, strategy files, trade log, API, research — every run takes a different amount.

Why Cloud Code routines instead of standard automation? Because with routines, we get the full autonomy of working with Cloud Code manually. It goes through the whole agentic loop of figuring things out. With Opus 4.7, it's really good at this.

---

## Step 1: Strategy

Think of this like you're teaching a kid to ride a bike. You can't expect to just throw a kid on a bike and it's instantly going to be magic.

**Start with paper trading first if you're not comfortable.** This is not financial advice.

You need a strategy. Write down:
- How often are you checking the news?
- What are the signals that make you buy or sell?
- Your gut intuition and trading routine

Over time, you're going to help it learn from its mistakes and iterate.

### About the GenTik Financial Analysis Benchmark

In the official release of Cloud Opus 4.7, GenTik financial analysis is at 64.4%. This means it is really good at **analyzing a company** — digesting filings and writing coherent fundamentals-driven theses. But it's NOT a signal for day trading. This maps to **long term or swing or fundamentals driven strategies**, not day trading.

---

## Step 2: The Scaffold

Open a new folder and open Cloud Code. I started in VS Code because you can see all files on the left-hand side.

I migrated my strategy from my OpenClaw agent by asking it to break down:
- The strategy and cron jobs
- What it looks for during research
- Sub-agents, signals
- All learnings

Then I told Cloud Code to ingest this information and organize the project.

---

## Step 3: Guard Rails

Before working on trading logic, think about:
- Start with paper mode, toggle real trading when comfortable
- Max 5% of portfolio per position
- Daily loss cap
- What NOT to do (e.g., no options, only 3 new positions per week)

Watch every single run. Read through conversation history. Tweak prompts and settings continuously. **Build the plane as you're flying.**

Develop skills for research, trading, etc. Make sure they're explicitly invoked for consistency.

---

## Step 4: Migration

I used Plan mode in Cloud Code to brainstorm the project structure:
- Memory files
- Scripts
- Commands
- Updated CLAUDE.md file (~156 lines)

Key workflow:
1. Brain dump your strategy
2. Let Cloud Code organize it
3. Answer its questions — the more context, the better

---

## Step 5: Routines

Five recurring Cloud Code scheduled triggers (weekdays only):

| Routine | Time | Purpose |
|---|---|---|
| **Pre-market** | 6:00 AM | Research, catalysts, draft trade ideas |
| **Market Open** | 8:30 AM | Execute planned trades, set 10% trailing stops |
| **Midday** | 12:00 PM | Cut -7% losers, tighten stops on winners |
| **Market Close** | 3:00 PM | End of day summary, update memory |
| **Weekly Review** | Friday 4:00 PM | Full week analysis, grading |

Each prompt must:
1. Read files first
2. Do the work (research, trade, analyze)
3. Update all memory files
4. Grab API keys from **environment variables**, not .env files

---

## Step 6: Local vs Remote Routines

- **Local**: Lives on your machine. If you close the desktop app, the routine won't fire.
- **Remote**: Runs in the cloud. Your computer can be off. Requires a **GitHub repository**.

For remote: the routine clones the repo, works out of it, then destroys the cloud environment. You must make sure it **pushes changes back to the main repo** so the next agent picks them up.

---

## Step 7: Setting Up Environments

In the Cloud Desktop app:
1. Go to New Routine → Remote
2. Create a Cloud Environment (e.g., "trading")
3. Set up API keys: Alpaca, Perplexity, ClickUp
4. Give full network access
5. Enable **"Allow unrestricted branch pushes"** in permissions

**Important:** API key names must match exactly letter-for-letter with what's in the environment variables.

---

## Step 8: Testing

Always do a "Run Now" at least a few times before relying on scheduled runs.

### Results

- Weekly review was ran successfully
- Commits pushed to GitHub by Claude
- Notifications sent to ClickUp with portfolio status, S&P comparison, trades, and self-grading (C for the week)
- Alpaca balance confirmed: $9,859

---

## Session Limits

Four automations per day won't necessarily eat all your session limits. Managing context is key. Using routines is way cheaper than doing the same via API.

---

## Hidden Lesson

> Files aren't just memory — they're essentially the agent's full personality and discipline.

It's about orchestrating the right files so the agent can access the right ones when it needs to.

---

*Free 13-page PDF resource available in Nate's free School community (link in video description).*
