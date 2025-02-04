package queryhistory

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestUnstarQueryInQueryHistory(t *testing.T) {
	testScenarioWithQueryInQueryHistory(t, "When users tries to unstar query in query history that does not exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.starHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to unstar starred query in query history, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.service.starHandler(sc.reqContext)
			resp := sc.service.unstarHandler(sc.reqContext)
			fmt.Println(resp)
			require.Equal(t, 200, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to unstar query in query history that is not starred, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.unstarHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})
}
