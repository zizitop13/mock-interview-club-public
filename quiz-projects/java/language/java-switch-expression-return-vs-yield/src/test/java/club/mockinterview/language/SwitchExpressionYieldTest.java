package club.mockinterview.language;

import static club.mockinterview.language.SwitchExpressionYield.Zone.INTERNATIONAL;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.ToolProvider;

import org.junit.jupiter.api.Test;

class SwitchExpressionYieldTest {
    private static final SwitchExpressionYield.Parcel HEAVY_INTERNATIONAL =
            new SwitchExpressionYield.Parcel(INTERNATIONAL, 25);

    @Test
    void returnCannotLeaveAMethodFromInsideASwitchExpression() {
        String source = """
                class BrokenShippingCost {
                    static int cost(int weight) {
                        return switch (weight) {
                            case 25 -> { return 40; }
                            default -> 20;
                        };
                    }
                }
                """;
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        JavaFileObject file = new SourceFile("BrokenShippingCost", source);

        boolean compiled = ToolProvider.getSystemJavaCompiler()
                .getTask(null, null, diagnostics, List.of("--release", "27"), null, List.of(file))
                .call();

        assertFalse(compiled);
        assertTrue(diagnostics.getDiagnostics().stream()
                .map(diagnostic -> diagnostic.getMessage(null))
                .anyMatch(message -> message.contains("return out of a switch expression")));
    }

    @Test
    void yieldProducesTheSwitchValueAndContinuesTheMethod() {
        assertEquals(44, SwitchExpressionYield.fixedShippingCost(HEAVY_INTERNATIONAL));
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
