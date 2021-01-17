# Gantt for Grafana

[![Build](https://github.com/marcusolsson/grafana-gantt-panel/workflows/CI/badge.svg)](https://github.com/marcusolsson/grafana-gantt-panel/actions?query=workflow%3A%22CI%22)
[![Release](https://github.com/marcusolsson/grafana-gantt-panel/workflows/Release/badge.svg)](https://github.com/marcusolsson/grafana-gantt-panel/actions?query=workflow%3ARelease)
[![Marketplace](https://img.shields.io/badge/dynamic/json?color=orange&label=marketplace&prefix=v&query=%24.items%5B%3F%28%40.slug%20%3D%3D%20%22marcusolsson-gantt-panel%22%29%5D.version&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins)](https://grafana.com/grafana/plugins/marcusolsson-gantt-panel)
[![Downloads](https://img.shields.io/badge/dynamic/json?color=orange&label=downloads&query=%24.items%5B%3F%28%40.slug%20%3D%3D%20%22marcusolsson-gantt-panel%22%29%5D.downloads&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins)](https://grafana.com/grafana/plugins/marcusolsson-gantt-panel)
[![License](https://img.shields.io/github/license/marcusolsson/grafana-gantt-panel)](LICENSE)
[![Twitter](https://img.shields.io/twitter/follow/marcusolsson?color=%231DA1F2&label=twitter&style=plastic)](https://twitter.com/marcusolsson)

A panel plugin for [Grafana](https://grafana.com) to visualize Gantt charts.

**Important:** This plugin is still under development and is **not fit for production use**. Please use it and [submit issues](https://github.com/marcusolsson/grafana-gantt-panel/issues/new) to improve it.

![Screenshot](https://github.com/marcusolsson/grafana-gantt-panel/raw/main/src/img/screenshot.png)

## Configuration

This section lists the available configuration options for the Gantt panel.

### Panel options

#### Dimensions

| Option | Description |
|--------|-------------|
| _Text_ | Name of the field to use for activity labels. Defaults to the first string field. |
| _Start time_ | Name of the field to use for value. Defaults to the first time field. |
| _End time_ | Name of the field to use for value. Defaults to the second time field. |
| _Group by_ | Name of the field to use to group activities. When grouping activities, the time interval is set to the start of the first activity and the end of the last activity in the group. |
