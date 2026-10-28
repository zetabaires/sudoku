package ar.com.sudokusimple;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;

/** Local-only game. No network permission, SDKs, accounts or external dependencies. */
public final class MainActivity extends Activity {
    private WebView web;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(245, 246, 250));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setBlockNetworkLoads(true);
        web.setWebViewClient(new WebViewClient() {
            private final String origin = "https://appassets.androidplatform.net/";
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(origin)) {
                    String path = request.getUrl().getPath();
                    if (path == null || path.contains("..")) return empty();
                    if (path.equals("/")) path = "/index.html";
                    String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" : "text/javascript";
                    try {
                        return new WebResourceResponse(mime, "UTF-8", getAssets().open(path.substring(1)));
                    } catch (Exception e) { return empty(); }
                }
                return empty();
            }
            private WebResourceResponse empty() {
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith(origin);
            }
        });
        // WebView does not reliably inset HTML when padding is applied to it directly.
        // Inset its parent so Android measures the entire WebView inside the safe area.
        FrameLayout content = new FrameLayout(this);
        content.setBackgroundColor(Color.WHITE);
        content.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            content.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(content);
        content.post(content::requestApplyInsets);
        web.loadUrl("https://appassets.androidplatform.net/index.html");
    }

    @Override protected void onPause() {
        web.evaluateJavascript("window.nativeVisibility && window.nativeVisibility(false)", null);
        super.onPause();
        web.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("window.nativeVisibility && window.nativeVisibility(true)", null);
        }
    }
    @Override protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
