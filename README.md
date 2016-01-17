# HomeCraft

A MineCraft server runner for OS X focused on performances. 
Great for hosting your server at home with your friends.

HomeCraft caches your world data in RAM keeping your SSD safe and your game fast.

## Pre-requisites

- Download and install the latest version of [java](http://www.oracle.com/technetwork/java/javase/downloads/index.html)
- Download [minecraft multiplayer server](https://minecraft.net/download) locally.

## Install and Run

  ```bash
  mkdir homecraft && cd homecraft
  git clone https://github.com/erremauro/homecraft.git .
  npm install
  npm start
  ```

## Supported Commands

All standard minecraft server command are supported. Additionally you can also use these commands to control HomeCraft.

**save**: You can persist your data locally at anytime by writing `save` 
in the console while server is running.
**stop**: To stop your server simply write `stop` in your console while server is running.
**restart**: You can restart your server by write `restart` or `rs` in your console while server is running.
