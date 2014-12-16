# Next Grumman [![Codeship Status for Financial-Times/next-grumman](https://codeship.com/projects/97825450-6419-0132-c840-164ea2c5352e/status)](https://codeship.com/projects/53047)

## Installation

```
git clone https://github.com/Financial-Times/next-grumman.git
npm install && bower install
```

## Dependencies

Please install `next-router` globally.

## Run

Just run grumman on its own (localhost:3003):

```
make run-local
```

Run grumman through the router (localhost:5050):

```
make run
```

## Troubleshooting

Note origami-build-tools isn't compatible with all versions of SASS.  If you are getting errors (particularly with SASS 3.4) try running `bundle install` within this directory and prefixing all commands with `bundle exec`, e.g. `bundle exec make build`.
