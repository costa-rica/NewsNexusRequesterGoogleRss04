# README: Format

This document outlines the format I want in my README.md files that are stored at the root of the project. The goal of this is to make it human readable and easy to understand. This means:

- concise explainations or instructions,
- subsections, bullet points and numbered lists are preferred over long paragraphs,
- limited bold formatting - never for beginning of headings, bullets, or numbered list items,
- shorter is better than longer,

Each section below will be required unless there is an `(optional)` next to it.

## Project Overview

This section should be a concise overview of the project. It should be no more than 2-3 sentences long. Include the tech stack used and the purpose of the project.

## Setup

This should include how to install. Do not list packages. If there is a custom package that needs to be installed, it should be mentioned here and how to install it. If the project is a TypeScript so we need `npm install` and `npm build`. If it's a Python project, include examples of creating the venv.

## Usage

This section should explain how to use the project. If this is an app that runs on the terminal with arguments, include examples of how to run it with different arguments. If it's a web app, include the URL to access it. If it's a library, include examples of how to use it.

## Project Structure

Use a tree structure to show the project structure. Certain folders do not need to show all files, like an API routes we only need to show at most 5 routes. If there are subfolders, show those and only a few files in each subfolder.

## .env

This section should explain the environment variables used in the project. Include the name of the environment variable and a brief description of what it is used for. Do not include the value of the environment variable.

## External Files (optional)

If usage requires external files, such as a spreadsheet, text file, etc. Create a sub section for each file. Include the naming convention and the expected contents of the file. If it is a spreadsheet that the project will read from, include the column headers and what each column is used for. If it is a spreadsheet that the project will write to, explain the output columns. If a JSON file is used or made, include the structure of the file.

## References

My projects will usually have instructions for logging (i.e. docs/LOGGING_NODE_JS_V06.md) or other instructions in the docs folder. Include a reference to those files here. No need to explain what they are, just reference them.
