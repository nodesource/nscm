
# NodeSource Certified Modules

`nscm` is a simple utility to whitelist non-certified packages and can be used to generate a report of matching certified packages in a specified private registry.

## Installation

You can install it from `npm` by running:

```
$ npm install -g nscm
```

## Usage

This tool is meant to be used in the root folder of an application where the `package.json` file exists.

```
Usage: nscm [command] [options]

  Commands:

    config, c     Configure nscm options
    help          Display help
    report, r     Get a report of your packages
    whitelist, w  Whitelist your packages
    signin, s     Sign into nscm via email (--github or --google for SSO)
    signout, o    Sign out of nscm

  Options:

    -c, --concurrency <n>  Concurrency of requests (defaults to 15)
    -h, --help             Output usage information
    -j, --json             Formats the report in JSON (disabled by default)
    -s, --svg              Formats the report in SVG (disabled by default)
    -d, --dot              Formats the report in Graphviz DOT (disabled by default)
    -p, --production       Only check production (disabled by default)
    -r, --registry         Certified modules registry (defaults to "")
    -t, --token            Token for registry authentication (defaults to "")
    -v, --version          Output the version number
```

## `nscm report` (default)

Returns a report of matching certified packages and their certification scores.

```
$ nscm report
please wait while we process the information
┌────────────────────────────────────┬───────────────┬────────┐
│ Package                            │ Version       │ Score  │
├────────────────────────────────────┼───────────────┼────────┤
│ body-parser                        │ 1.15.2        │ 100    │
├────────────────────────────────────┼───────────────┼────────┤
│ debug                              │ 2.2.0         │ 70     │
├────────────────────────────────────┼───────────────┼────────┤
│ ms                                 │ 0.7.1         │ 100    │
├────────────────────────────────────┼───────────────┼────────┤
│ bytes                              │ 2.4.0         │ 100    │
├────────────────────────────────────┼───────────────┼────────┤
│ content-type                       │ 1.0.2         │ 100    │
├────────────────────────────────────┼───────────────┼────────┤
│ depd                               │ 1.1.0         │ 100    │
├────────────────────────────────────┼───────────────┼────────┤
│ http-errors                        │ 1.5.1         │ 100    │
├────────────────────────────────────┼───────────────┼────────┤
│ inherits                           │ 2.0.3         │ 100    │
├────────────────────────────────────┼───────────────┼────────┤
```

You can also pass `--json` to return the report in JSON format,
`--svg` to return the report in SVG format, or
`--dot` to return the report in [Graphviz][] DOT format.
Use `--production` to return only `dependencies` and not `devDependencies`.

[Graphviz]: http://www.graphviz.org/

```
$ nscm report --production --json
please wait while we process the information
[
  {
    "name": "body-parser",
    "version": "1.15.2",
    "from": "body-parser@>=1.15.2 <1.16.0",
    "score": 100
  },
  {
    "name": "debug",
    "version": "2.2.0",
    "from": "debug@>=2.2.0 <2.3.0",
    "score": 70
  },
  {
    "name": "ms",
    "version": "0.7.1",
    "from": "ms@0.7.1",
    "score": 100
  },
  {
    "name": "bytes",
    "version": "2.4.0",
    "from": "bytes@2.4.0",
    "score": 100
  },
...
```

## `nscm whitelist`

Check which packages aren't certified, and start an interactive prompt to add packages to the whitelist.

```
$ nscm whitelist
please wait while we process the information

37 packages aren't certified, do you want to add them to the whitelist?
? add debug@2.2.0 Yes
? add setprototypeof@1.0.2 Yes
? add statuses@1.3.1 No
? add ee-first@1.1.1 No
? add unpipe@1.0.0 (ynaH) All

┌────────────────────────────────────┬───────────────┬────────┐
│ Package                            │ Version       │ Score  │
├────────────────────────────────────┼───────────────┼────────┤
│ debug                              │ 2.2.0         │ 70     │
├────────────────────────────────────┼───────────────┼────────┤
│ setprototypeof                     │ 1.0.2         │        │
├────────────────────────────────────┼───────────────┼────────┤
...
├────────────────────────────────────┼───────────────┼────────┤
│ source-list-map                    │ 0.1.8         │        │
├────────────────────────────────────┼───────────────┼────────┤
│ webpack-core                       │ 0.6.9         │        │
└────────────────────────────────────┴───────────────┴────────┘
35 packages added to the whitelist
```

You can also pass `--all` to add all the packages to the whitelist and `--json` to return the packages in a JSON format.

### `nscm whitelist add`

Add a package and its dependencies to the whitelist.

```
$ nscm whitelist add debug@2.x
```

If you pass only the package name, `nscm` will use `latest`.  You can also pass a semver range or a specific version. If a semver range is passed it will be resolved to the highest published version that matches the range.

### `nscm whitelist delete`

Delete a package from the whitelist.

```
$ nscm whitelist delete debug
```

### `nscm whitelist list`

Lists all whitelisted packages.

```
$ nscm whitelist list
┌────────────────────────────────────┬───────────────┬────────┐
│ Package                            │ Version       │ Score  │
├────────────────────────────────────┼───────────────┼────────┤
│ acorn                              │ 4.0.1         │        │
├────────────────────────────────────┼───────────────┼────────┤
│ isarray                            │ 2.0.1         │        │
└────────────────────────────────────┴───────────────┴────────┘
2 packages in the whitelist
```
### `nscm whitelist reset`

Removes all whitelisted packages.

## `nscm config`

### Configuration Options

* `token` - Authentication Token. If not specified, it will be fetched from `~/.npmrc` - **required**
* `registry` - Private NodeSource Certified Modules registry URL. If not specified, it will be fetched from `~/.npmrc` - **required**
* `concurrency` - Concurrency of requests to package registry - default: 15

### `nscm config set <key> <value>`

Modify the specified configuration option.

```
$ nscm config set concurrency 10
```

### `nscm config get`

Gets a configuration option

```
$ nscm config get registry
https://{registryId}.registry.nodesource.io
```

### `nscm config delete`

Deletes a configuration option.

```
$ nscm config delete token
```

### `nscm config list`

List all configuration options.

```
$ nscm config list
concurrency = 15
registry = https://{registryId}.registry.nodesource.io
```
## Authors and Contributors

<table><tbody>
<tr><th align="left">Nathan White</th><td><a href="https://github.com/nw">GitHub/nw</a></td><td><a href="http://twitter.com/_nw_">Twitter/@_nw_</a></td></tr>
<tr><th align="left">Julián Duque</th><td><a href="https://github.com/julianduque">GitHub/julianduque</a></td><td><a href="http://twitter.com/julian_duque">Twitter/@julian_duque</a></td></tr>
<tr><th align="left">Adrián Estrada</th><td><a href="https://github.com/edsadr">GitHub/edsadr</a></td><td><a href="http://twitter.com/edsadr">Twitter/@edsadr</a></td></tr>
</tbody></table>

Contributions are welcomed from anyone wanting to improve this project!

## License & Copyright

**nscm** is Copyright (c) 2017 NodeSource and licensed under the MIT license. All rights not explicitly granted in the MIT license are reserved. See the included [LICENSE.md](https://github.com/nodesource/nscm/blob/master/LICENSE.md) file for more details.
