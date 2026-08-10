# Maven 3.9.16 is the version .mvn/wrapper/maven-wrapper.properties pins, so this
# image and a local ./mvnw build resolve the same plugins.
FROM maven:3.9.16-eclipse-temurin-21 AS build
WORKDIR /build

# Dependencies resolve in their own layer, so editing a source file does not refetch them.
COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src/ src/
# The test suite is Testcontainers-based and there is no Docker daemon inside a build.
RUN mvn -B -Dmaven.test.skip=true clean package

# A JRE, not a JDK: the compiler, Maven and the sources never reach production, and a
# smaller image is a shorter cold start because Render has to pull it before it runs.
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# A compromised process should not be root, and nothing here needs to be.
RUN addgroup -S app && adduser -S -G app app
USER app

COPY --from=build /build/target/*.jar app.jar

EXPOSE 8080

# MaxRAMPercentage: the JVM's default assumes room for a heap plus everything else. On a
# 512 MB instance that overcommits, and the kernel kills the process rather than throwing.
# SerialGC and TieredStopAtLevel=1 trade peak throughput for a faster, smaller start --
# the right way round on a free instance that sleeps and wakes far more than it works.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-jar", "app.jar"]
