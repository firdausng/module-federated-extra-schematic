# Getting Started With Schematics

This repository is a basic Schematic implementation that serves as a starting point to create and publish Schematics to NPM.

### Use Locally

First need to build in schematic repo and do global link
```bash
npm run build
npm link
```

Then need to add the schematic to another angular projects
```bash
npm link module-federated-extra-schematic  
ng generate module-federated-extra-schematic:ng-add --project=shell --port=4200 --type=host
```

### Testing

To test locally, install `@angular-devkit/schematics-cli` globally and use the `schematics` command line tool. That tool acts the same as the `generate` command of the Angular CLI, but also has a debug mode.

Check the documentation with

```bash
schematics --help
```

### Unit Testing

`npm run test` will run the unit tests, using Jasmine as a runner and test framework.

### Publishing

To publish, simply do:

```bash
npm run build
npm publish
```

That's it!
