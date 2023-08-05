# Example commands

## Generator
### Parent
Generate a parent project with a pom at the root of our project

```shell
npx nx generate @nx-dev-tools/java-mvn:parent library parent-lib com.example -l .
```

### Project
Generate a project lib

```shell
npx nx generate @nx-dev-tools/java-mvn:project library lib1 -rae properties
```

### Project
Generate a project app

```shell
npx nx generate @nx-dev-tools/java-mvn:project application app1 -rae properties
```
