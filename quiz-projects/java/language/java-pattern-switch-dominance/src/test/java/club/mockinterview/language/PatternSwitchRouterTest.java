package club.mockinterview.language;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;

class PatternSwitchRouterTest {
    @Test
    void broadPatternMakesLaterStringPatternUnreachable() {
        String source = """
                class BrokenRouter {
                    static String route(Object message) {
                        return switch (message) {
                            case CharSequence text -> "TEXT";
                            case String json when json.startsWith("{") -> "JSON";
                            case null -> "EMPTY";
                            default -> "OTHER";
                        };
                    }
                }
                """;
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        JavaFileObject file = new SourceFile("BrokenRouter", source);

        boolean compiled = ToolProvider.getSystemJavaCompiler()
                .getTask(null, null, diagnostics, List.of("--release", "27"), null, List.of(file))
                .call();

        assertFalse(compiled);
        assertTrue(diagnostics.getDiagnostics().stream()
                .map(diagnostic -> diagnostic.getMessage(null).toLowerCase())
                .anyMatch(message -> message.contains("dominated")));
    }

    @Test
    void specificGuardedPatternRunsBeforeGeneralTextFallback() {
        assertEquals(PatternSwitchRouter.Route.JSON, PatternSwitchRouter.route("  {\"id\":1}"));
        assertEquals(PatternSwitchRouter.Route.TEXT, PatternSwitchRouter.route("plain text"));
        assertEquals(PatternSwitchRouter.Route.TEXT, PatternSwitchRouter.route(new StringBuilder("text")));
        assertEquals(PatternSwitchRouter.Route.EMPTY, PatternSwitchRouter.route(null));
        assertEquals(PatternSwitchRouter.Route.OTHER, PatternSwitchRouter.route(42));
    }

    private static final class SourceFile extends SimpleJavaFileObject {
        private final String source;

        private SourceFile(String className, String source) {
            super(URI.create("string:///" + className + Kind.SOURCE.extension), Kind.SOURCE);
            this.source = source;
        }

        @Override
        public CharSequence getCharContent(boolean ignoreEncodingErrors) {
            return source;
        }
    }
}
